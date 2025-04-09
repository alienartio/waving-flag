export const WaveFilter = function (imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  // Reference dimensions to match original visual look
  const refWidth = 500;
  const refHeight = 500;

  // Normalize params to scale proportionally based on 150x150 reference
  const waveLength = (this.waveLength() || refWidth / 8) * (w / refWidth);
  const amplitude  = (this.waveAmplitude() || 15) * (h / refHeight);
  const period     = this.wavePeriod() || 200;
  const shading    = this.waveShading() || 80;
  const squeeze    = (this.waveSqueeze() || 0.1) * (h / refHeight);
  const phase      = this.wavePhase();

  const now = 2 * Math.PI * phase / period;

  const originalData = new Uint8ClampedArray(data);

  const invW = 1 / w;
  const invWL = 1 / waveLength;
  const factor = 1 / 0.8;
  const halfH = h * 0.5;

  const prePct = new Float32Array(w);
  const preO = new Float32Array(w);
  const preSlope = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const pct = x * invW;
    prePct[x] = pct;
    const fx = x * invWL;
    const wave1 = Math.sin(fx - now) * 0.7;
    const wave2 = Math.sin(fx * factor - now) * 0.3;
    const o = (wave1 + wave2) * amplitude * pct;
    preO[x] = o;
    preSlope[x] = x === 0 ? o : o - preO[x - 1];
  }

  let destIndex = 0;
  for (let y = 0; y < h; y++) {
    const sq = (y - halfH) * (squeeze / h);  // squeeze now scales correctly
    const edgeShadow = (1 - Math.abs(y - halfH) / halfH) * 20;

    for (let x = 0; x < w; x++, destIndex += 4) {
      const pct = prePct[x];
      const o = preO[x];

      const xShift = o * 0.3;
      const sourceX = x + xShift;
      const sourceY = y + o + sq * pct;

      const srcX = Math.round(sourceX);
      const srcY = Math.round(sourceY);

      if (srcX < 0 || srcX >= w || srcY < 0 || srcY >= h) {
        data[destIndex]     = 0;
        data[destIndex + 1] = 0;
        data[destIndex + 2] = 0;
        data[destIndex + 3] = 0;
      } else {
        const sourceIndex = (srcY * w + srcX) * 4;
        const slope = preSlope[x];
        const shade = slope * shading;
        const verticalShade = (o + sq * pct) * 15;
        const delta = shade - verticalShade - edgeShadow;

        const r = originalData[sourceIndex]     + delta;
        const g = originalData[sourceIndex + 1] + delta;
        const b = originalData[sourceIndex + 2] + delta;
        data[destIndex]     = r < 0 ? 0 : (r > 255 ? 255 : r);
        data[destIndex + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
        data[destIndex + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
        data[destIndex + 3] = originalData[sourceIndex + 3];
      }
    }
  }
};

export class WavingImage extends Konva.Image {
  constructor(config) {
    super(config);
    this._waveAmplitude = 5; // default value
    this._waveLength = 50;   // default value
    this._wavePhase = 0;     // default value
    this._wavePeriod = 1000;  // default value
    this._waveShading = 400; // default value
    this._waveSqueeze = 0;   // default value
  }
  waveAmplitude(value) {
    if (value !== undefined) {
      this._waveAmplitude = value;
    }
    return this._waveAmplitude;
  }

  // Getter and setter for waveLength
  waveLength(value) {
    if (value !== undefined) {
      this._waveLength = value;
    }
    return this._waveLength;
  }

  // Getter and setter for wavePhase
  wavePhase(value) {
    if (value !== undefined) {
      this._wavePhase = value;
      this._filterUpToDate = false;
    }
    return this._wavePhase;
  }

  // Getter and setter for wavePeriod
  wavePeriod(value) {
    if (value !== undefined) {
      this._wavePeriod = value;
    }
    return this._wavePeriod;
  }

  // Getter and setter for waveShading
  waveShading(value) {
    if (value !== undefined) {
      this._waveShading = value;
    }
    return this._waveShading;
  }

  // Getter and setter for waveSqueeze
  waveSqueeze(value) {
    if (value !== undefined) {
      this._waveSqueeze = value;
    }
    return this._waveSqueeze;
  }
  animate(time) {
    this.wavePhase(time);
  }
}