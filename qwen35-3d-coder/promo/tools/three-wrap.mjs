// Re-exports three r160 and records every renderable added to the scene graph,
// with the deepest line of the page it depends on (from the call stack).
import * as T from './three.module.min.js';
const rec = (window.__adds = []);
const add0 = T.Object3D.prototype.add;
const PAGE = /\/page\.html:(\d+):\d+/g;
T.Object3D.prototype.add = function (...objs) {
  let line = 0;
  for (const m of String(new Error().stack).matchAll(PAGE)) line = Math.max(line, +m[1]);
  for (const o of objs) {
    if (!o) continue;
    o.traverse((n) => {
      if ((n.isMesh || n.isLine || n.isPoints || n.isSprite) && !n.__rec) {
        n.__rec = 1; rec.push({ o: n, line, vis: n.visible });
      }
    });
  }
  return add0.apply(this, objs);
};
export * from './three.module.min.js';
