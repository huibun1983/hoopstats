/**
 * AsrEngine - 腾讯云 ASR 语音识别引擎
 * 替代 webkitSpeechRecognition（国内被墙无法使用）
 *
 * 流程：MediaRecorder 录音 → base64 → Worker /api/asr → 腾讯云 ASR → 文字
 *
 * @author 周瑜 (SnookerDesk CPO)
 * @version 1.0
 * @date 2026-05-05
 */
class AsrEngine {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || 'https://api.statstalking.com/api/asr';
    this.maxDuration = options.maxDuration || 60000; // 最长60秒
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.timer = null;
    this.callback = null;
    this.supportedTypes = this._detectSupportedTypes();
  }

  /**
   * 检测浏览器支持的录音格式
   */
  _detectSupportedTypes() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/aac',
    ];
    return candidates.filter(t => MediaRecorder.isTypeSupported(t));
  }

  /**
   * 获取最佳 MIME 类型（腾讯云 ASR 支持：wav/mp3/webm/pcm/aac 等）
   */
  _getBestMime() {
    if (this.supportedTypes.length > 0) {
      return this.supportedTypes[0]; // 浏览器首选
    }
    return 'audio/webm'; // fallback
  }

  /**
   * 将 MIME 类型映射为腾讯云 ASR VoiceFormat 参数
   */
  _mimeToVoiceFormat(mimeType) {
    if (mimeType.includes('webm') || mimeType.includes('opus')) return 'webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a'))  return 'm4a';
    if (mimeType.includes('aac')) return 'aac';
    if (mimeType.includes('mp3')) return 'mp3';
    return 'webm'; // 兜底
  }

  /**
   * 开始录音
   * @param {Function} callback - 识别结果回调 (result: {text, error})
   * @returns {Promise<boolean>}
   */
  async start(callback) {
    if (this.isRecording) return false;
    if (!navigator.mediaDevices?.getUserMedia) {
      if (callback) callback({ error: 'UNSUPPORTED', message: '浏览器不支持录音' });
      return false;
    }

    this.callback = callback;
    this.audioChunks = [];

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('[AsrEngine] 无法获取麦克风:', err);
      if (callback) callback({ error: 'MIC_DENIED', message: '麦克风权限被拒绝' });
      return false;
    }

    const mimeType = this._getBestMime();
    try {
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    } catch (e) {
      // fallback: 不带 mimeType
      try {
        this.mediaRecorder = new MediaRecorder(this.stream);
      } catch (e2) {
        if (callback) callback({ error: 'RECORDER_FAIL', message: '无法创建录音对象' });
        this._cleanupStream();
        return false;
      }
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      await this._onStop();
    };

    this.mediaRecorder.start(500); // 每 500ms 触发一次 dataavailable
    this.isRecording = true;

    // 安全计时器（最长 maxDuration）
    this.timer = setTimeout(() => this.stop(), this.maxDuration);

    console.log(`[AsrEngine] 开始录音，格式: ${mimeType}`);
    return true;
  }

  /**
   * 停止录音（触发 onstop → 上传识别）
   */
  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    } else {
      // MediaRecorder 已停止，手动触发上传
      this._onStop();
    }
  }

  /**
   * 录音停止后：合并 Blob → base64 → 调 ASR API
   */
  async _onStop() {
    this._cleanupStream();

    if (this.audioChunks.length === 0) {
      if (this.callback) this.callback({ error: 'NO_AUDIO', message: '未录到音频数据' });
      return;
    }

    const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
    const blob = new Blob(this.audioChunks, { type: mimeType });

    console.log(`[AsrEngine] 录音完成，大小: ${(blob.size / 1024).toFixed(1)}KB，格式: ${mimeType}`);

    if (blob.size > 3 * 1024 * 1024) {
      if (this.callback) this.callback({ error: 'TOO_LARGE', message: '音频超过 3MB 限制' });
      return;
    }

    try {
      const base64 = await this._blobToBase64(blob);
      const voiceFormat = this._mimeToVoiceFormat(mimeType);

      console.log(`[AsrEngine] 调用 ASR API，voiceFormat=${voiceFormat}`);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64,
          voiceFormat: voiceFormat,
          dataLen: blob.size,
          sampleRate: 16000,
        }),
      });

      const result = await response.json();

      if (result.success && result.text) {
        console.log(`[AsrEngine] 识别成功: "${result.text}"`);
        if (this.callback) this.callback({ text: result.text.trim() });
      } else {
        console.warn('[AsrEngine] 识别失败:', result.error);
        if (this.callback) this.callback({ error: 'ASR_FAIL', message: result.error || '识别失败' });
      }
    } catch (err) {
      console.error('[AsrEngine] 上传失败:', err);
      if (this.callback) this.callback({ error: 'UPLOAD_FAIL', message: err.message });
    }
  }

  /**
   * Blob → base64 字符串（不含 data: 前缀）
   */
  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // reader.result = "data:audio/webm;base64,xxxxx"
        const base64 = reader.result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('FileReader 失败'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 停止 MediaStream（释放麦克风）
   */
  _cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.stop();
    this._cleanupStream();
    this.callback = null;
  }

  /**
   * 检查浏览器是否支持
   */
  static isSupported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AsrEngine;
}
