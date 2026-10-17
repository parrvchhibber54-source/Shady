// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ImagePreview from '../app/image-preview';
beforeEach(()=>{window.matchMedia=vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})) as unknown as typeof window.matchMedia;});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('starts the magnifier for a cached image without requiring a second load event',()=>{
 vi.spyOn(HTMLImageElement.prototype,'complete','get').mockReturnValue(true);
 vi.spyOn(HTMLImageElement.prototype,'naturalWidth','get').mockReturnValue(640);
 render(<ImagePreview src="blob:cached" name="cached.png" loading onError={vi.fn()}/>);
 expect(screen.getByTestId('zoom-lens')).toBeInTheDocument();
});
it('waits for the current image, then hides the lens as soon as analysis finishes',()=>{
 const props={src:'blob:first',name:'photo.png',loading:true,onError:vi.fn()};
 const {rerender}=render(<ImagePreview {...props}/>);
 fireEvent.load(screen.getByAltText('Preview of photo.png'));expect(screen.getByTestId('zoom-lens')).toBeInTheDocument();
 rerender(<ImagePreview {...props} src="blob:second"/>);expect(screen.queryByTestId('zoom-lens')).not.toBeInTheDocument();
 fireEvent.load(screen.getByAltText('Preview of photo.png'));expect(screen.getByTestId('zoom-lens')).toBeInTheDocument();
 rerender(<ImagePreview {...props} src="blob:second" loading={false}/>);expect(screen.queryByTestId('zoom-lens')).not.toBeInTheDocument();
});

it('moves the lens during analysis and cancels animation when it ends',()=>{
 vi.spyOn(document,'hidden','get').mockReturnValue(false);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:450,height:300,left:0,top:0,right:450,bottom:300,x:0,y:0,toJSON:()=>({})});
 let tick:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',vi.fn((fn:FrameRequestCallback)=>{tick=fn;return 1;}));
 const cancel=vi.fn();vi.stubGlobal('cancelAnimationFrame',cancel);
 const props={src:'blob:motion',name:'motion.png',loading:true,onError:vi.fn()};
 const {rerender}=render(<ImagePreview {...props}/>);fireEvent.load(screen.getByAltText('Preview of motion.png'));
 act(()=>tick(1000));const first=screen.getByTestId('zoom-lens').style.transform;
 act(()=>tick(2000));expect(screen.getByTestId('zoom-lens').style.transform).not.toBe(first);
 rerender(<ImagePreview {...props} loading={false}/>);expect(cancel).toHaveBeenCalledWith(1);expect(screen.queryByTestId('zoom-lens')).not.toBeInTheDocument();
});
it('keeps a visible stationary lens for reduced-motion preferences',()=>{
 window.matchMedia=vi.fn(()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()})) as unknown as typeof window.matchMedia;
 const schedule=vi.fn();vi.stubGlobal('requestAnimationFrame',schedule);
 render(<ImagePreview src="blob:still" name="still.png" loading onError={vi.fn()}/>);fireEvent.load(screen.getByAltText('Preview of still.png'));
 expect(screen.getByTestId('zoom-lens')).toBeInTheDocument();expect(schedule).not.toHaveBeenCalled();
});
