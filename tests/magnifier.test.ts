import { describe, it, expect } from 'vitest';
import { lensGeometry } from '../lib/magnifier';
describe('magnified image alignment',()=>{
 it.each([[450,300],[120,400],[800,70]])('keeps the lens inside a %sx%s image throughout its route',(width,height)=>{
  for(let t=0;t<30;t+=.25){const g=lensGeometry(width,height,t); const r=g.diameter/2;expect(g.x-r).toBeGreaterThanOrEqual(0);expect(g.y-r).toBeGreaterThanOrEqual(0);expect(g.x+r).toBeLessThanOrEqual(width);expect(g.y+r).toBeLessThanOrEqual(height);}
 });
 it('maps the source point directly under the lens to the centre of the zoomed image',()=>{
  const g=lensGeometry(400,300,1.3);expect(g.backgroundWidth).toBe(800);expect(g.backgroundHeight).toBe(600);
  expect(g.x*2+g.backgroundX).toBeCloseTo(g.diameter/2);expect(g.y*2+g.backgroundY).toBeCloseTo(g.diameter/2);
 });
});
it.each([[24,410],[550,18],[32,32]])('keeps a readable, source-aligned lens on a %sx%s preview',(width,height)=>{
 for(let t=0;t<10;t+=.5){const g=lensGeometry(width,height,t);expect(g.diameter).toBeGreaterThanOrEqual(48);expect(g.x).toBeGreaterThanOrEqual(0);expect(g.x).toBeLessThanOrEqual(width);expect(g.y).toBeGreaterThanOrEqual(0);expect(g.y).toBeLessThanOrEqual(height);expect(g.x*2+g.backgroundX).toBeCloseTo(g.diameter/2);expect(g.y*2+g.backgroundY).toBeCloseTo(g.diameter/2);}
});
