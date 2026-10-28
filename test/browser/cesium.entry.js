import * as Cesium from 'cesium';

let viewer;
let tileset;

function readRenderedPixels(canvas, gl) {
  const width = canvas.width;
  const height = canvas.height;
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let nonBlackPixels = 0;
  const colors = new Set();
  const colorPixels = { red: 0, green: 0, blue: 0 };
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    if (red > 20 || green > 20 || blue > 20) {
      nonBlackPixels += 1;
      colors.add(`${Math.round(red / 32)},${Math.round(green / 32)},${Math.round(blue / 32)}`);
      if (red > green * 1.5 && red > blue * 1.5) colorPixels.red += 1;
      if (green > red * 1.5 && green > blue * 1.5) colorPixels.green += 1;
      if (blue > red * 1.5 && blue > green * 1.5) colorPixels.blue += 1;
    }
  }
  return { nonBlackPixels, distinctColorBins: colors.size, colorPixels, width, height };
}

window.startCesium = async () => {
  const startedAt = performance.now();
  viewer = new Cesium.Viewer(document.getElementById('cesiumContainer'), {
    baseLayer: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    scene3DOnly: true,
    requestRenderMode: false,
    contextOptions: {
      webgl: { alpha: false, antialias: false, preserveDrawingBuffer: true },
    },
  });
  viewer.scene.globe.show = false;
  viewer.scene.backgroundColor = Cesium.Color.BLACK;
  viewer.scene.skyBox.show = false;
  viewer.scene.skyAtmosphere.show = false;
  viewer.camera.setView({
    destination: new Cesium.Cartesian3(6378155, 0, 0),
    orientation: {
      direction: new Cesium.Cartesian3(-1, 0, 0),
      up: new Cesium.Cartesian3(0, 0, 1),
    },
  });

  const loadEvents = [];
  const tileLoadError = [];
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Cesium did not finish loading the initial tile view.')), 45_000);
    viewer.scene.renderError.addEventListener((_scene, error) => {
      clearTimeout(timeout);
      reject(error);
    });
    Cesium.Cesium3DTileset.fromUrl('/fixture/tileset.json', {
      maximumScreenSpaceError: 1,
      maximumNumberOfLoadedTiles: 16,
      dynamicScreenSpaceError: false,
      foveatedScreenSpaceError: false,
    }).then((createdTileset) => {
      tileset = createdTileset;
      tileset.tileFailed.addEventListener((event) => tileLoadError.push(event.message));
      tileset.tileLoad.addEventListener((tile) => {
        loadEvents.push({
          pointsLength: tile.content.pointsLength,
          center: [tile.boundingSphere.center.x, tile.boundingSphere.center.y, tile.boundingSphere.center.z],
        });
      });
      tileset.initialTilesLoaded.addEventListener(() => {
        clearTimeout(timeout);
        resolve();
      });
      viewer.scene.primitives.add(tileset);
      viewer.scene.requestRender();
    }).catch((error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  await loaded;
  const initialTilesLoadedAt = performance.now();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  viewer.render();
  const firstRenderedFrameAt = performance.now();
  const canvas = viewer.scene.canvas;
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) throw new Error('Cesium did not create a public WebGL canvas context.');
  const response = await fetch('/__stats');
  const resources = await response.json();
  return {
    tileLoads: loadEvents,
    pointCount: loadEvents.reduce((sum, event) => sum + event.pointsLength, 0),
    tileLoadErrors: tileLoadError,
    resources,
    pixels: readRenderedPixels(canvas, gl),
    tilesLoaded: tileset.tilesLoaded,
    initialTilesLoadMilliseconds: initialTilesLoadedAt - startedAt,
    postLoadRenderMilliseconds: firstRenderedFrameAt - initialTilesLoadedAt,
  };
};

window.disposeCesium = () => {
  if (viewer && !viewer.isDestroyed()) viewer.destroy();
  return { viewerDestroyed: viewer?.isDestroyed() ?? false };
};
