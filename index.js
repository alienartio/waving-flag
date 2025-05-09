import { createCanvas, Image, loadImage } from 'canvas';
import { exec } from 'child_process';
import fs from 'fs/promises';
import Konva from 'konva';
import path from 'path';
import sharp from 'sharp';
import { promisify } from 'util';
import { WaveFilter, WavingImage } from './wave.js';


const FRAME_COUNT = 30;
const FRAME_DURATION = 1000 / FRAME_COUNT;
const TARGET_HEIGHT = 512;

const canvas = createCanvas(1, 1)

global.Image = Image;
global.HTMLCanvasElement = createCanvas(1, 1).constructor;

async function loadImageAny(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === '.svg' || buffer.slice(0, 200).toString().includes('<svg')) {
    const pngBuffer = await sharp(buffer)
      .resize({ height: TARGET_HEIGHT })
      .png()
      .toBuffer();
    return await loadImage(pngBuffer);
  }

  return await loadImage(buffer);
}

async function generateFrames(inputPath, outputPath) {
  await fs.mkdir(outputPath, { recursive: true });
  const files = await fs.readdir(inputPath);

  for (const file of files) {
    if (file.startsWith('.')) {
      continue;
    }
    
    const fileName = path.parse(file).name;
    const outputDir = path.join(outputPath, fileName);
    
    // Check if output directory and sprite file already exist
    try {
      const outputExists = await fs.access(outputDir)
        .then(() => fs.access(path.join(outputDir, `${fileName}.sprite.png`)))
        .then(() => true)
        .catch(() => false);
      
      if (outputExists) {
        console.log(`Skipping ${file} - already processed`);
        continue;
      }
    } catch (error) {
      // Directory or file doesn't exist, continue processing
    }
    
    const timestamp = Date.now();
    console.log(`Started ${file}`);
    const fullPath = path.join(inputPath, file);
    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) continue;

    const img = await loadImageAny(fullPath);
    const aspectRatio = img.width / img.height;
    const targetHeight = TARGET_HEIGHT;
    const targetWidth = Math.round(TARGET_HEIGHT * aspectRatio);
    const previewHeight = 64;
    const previewWidth = Math.round(previewHeight * aspectRatio);

    const stage = new Konva.Stage({
      width: targetWidth,
      height: targetHeight,
      container: canvas
    });

    const layer = new Konva.Layer();
    stage.add(layer);

    const wavingImage = new WavingImage({
      image: img,
      x: 0,
      y: 0,
      width: targetWidth,
      height: targetHeight,
    });

    wavingImage.cache();
    wavingImage.filters([WaveFilter]);
    layer.add(wavingImage);

    await fs.mkdir(outputDir, { recursive: true });

    for (let i = 0; i < FRAME_COUNT; i++) {
      wavingImage.animate(i * FRAME_DURATION);
      layer.batchDraw();

      const canvas = stage.toCanvas();
      const buffer = await canvas.toBuffer('image/png');

      const framePath = path.join(outputDir, `frame-${String(i).padStart(3, '0')}.png`);
      await fs.writeFile(framePath, Buffer.from(buffer));


    }

    const pngPath = path.join(outputDir, 'frame-*.png');
    const webpPath = path.join(outputDir, `${fileName}.webp`);
    const spritePath = path.join(outputDir, `${fileName}.sprite.png`);
    const spriteJsonPath = path.join(outputDir, `${fileName}.sprite.json`);
    await promisify(exec)(`convert -delay 3 -loop 0 -resize ${previewWidth}x${previewHeight} ${pngPath} ${webpPath}`);
    await promisify(exec)(`convert +append ${pngPath} ${spritePath}`);
    await fs.writeFile(spriteJsonPath, Buffer.from(JSON.stringify({
      imageUrl: `./${fileName}.sprite.png`,
      previewUrl: `./${fileName}.webp`,
      width: targetWidth,
      height: targetHeight,
      frameRate: 30,
      frames: FRAME_COUNT,
      variants: 1
    }, null, 2)));
    await promisify(exec)(`rm ${pngPath}`);
    //await promisify(exec)(`oxipng -o 4 --strip all ${spritePath}`);

    console.log(`✅ Animated ${file} in ${Date.now() - timestamp}ms`);
  }

  console.log('🎉 All done!');
}

// CLI usage
const [,, inputDir, outputDir] = process.argv;
if (!inputDir || !outputDir) {
  console.error('Usage: bun index.js <input-folder> <output-folder>');
  process.exit(1);
}

generateFrames(inputDir, outputDir);