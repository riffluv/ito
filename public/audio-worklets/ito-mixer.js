class ItoMixerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._gain = 1;
    this.port.onmessage = (event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "setGain" && typeof data.value === "number") {
        this._gain = data.value;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !output || input.length === 0 || output.length === 0) {
      return true;
    }
    const channelCount = Math.min(input.length, output.length);
    const gain = this._gain;
    for (let channel = 0; channel < channelCount; channel += 1) {
      const source = input[channel];
      const target = output[channel];
      if (!source || !target) continue;
      const frameCount = Math.min(source.length, target.length);
      for (let i = 0; i < frameCount; i += 1) {
        target[i] = source[i] * gain;
      }
      for (let i = frameCount; i < target.length; i += 1) {
        target[i] = 0;
      }
    }
    if (channelCount > 0) {
      const reference = output[0];
      for (let channel = channelCount; channel < output.length; channel += 1) {
        const target = output[channel];
        if (!target) continue;
        const frameCount = Math.min(reference.length, target.length);
        for (let i = 0; i < frameCount; i += 1) {
          target[i] = reference[i];
        }
        for (let i = frameCount; i < target.length; i += 1) {
          target[i] = 0;
        }
      }
    } else {
      for (let channel = 0; channel < output.length; channel += 1) {
        const target = output[channel];
        if (!target) continue;
        target.fill(0);
      }
    }
    return true;
  }
}

registerProcessor("ito-mixer", ItoMixerProcessor);
