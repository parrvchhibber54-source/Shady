// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Detector from '../app/detector';
import {pollVideoResult,cancelVideo} from '../lib/video-client';
import {videoFixture} from './video-fixtures';
vi.mock('../lib/video-client',()=>({pollVideoResult:vi.fn(),cancelVideo:vi.fn()}));
beforeEach(()=>{URL.createObjectURL=vi.fn(()=> 'blob:video');URL.revokeObjectURL=vi.fn();vi.mocked(pollVideoResult).mockReset();vi.mocked(cancelVideo).mockReset();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function open(available=true){render(<Detector available textAvailable audioAvailable videoAvailable={available}/>);fireEvent.click(screen.getByRole('tab',{name:/^Video/}));}
function choose(){fireEvent.change(screen.getByLabelText('Choose video'),{target:{files:[new File(['synthetic'],'clip.mp4',{type:'video/mp4'})]}});}
function upload(){const mock=vi.fn().mockResolvedValue(Response.json({job:'a'.repeat(64),state:'processing'},{status:202}));vi.stubGlobal('fetch',mock);return mock;}
it('leaves video unavailable without invented results and preserves other tabs',()=>{open(false);expect(screen.getByText(/Live video analysis is unavailable/)).toBeVisible();choose();expect(screen.getByRole('button',{name:'Analyze video'})).toBeDisabled();fireEvent.keyDown(screen.getByRole('tab',{name:/^Video/}),{key:'ArrowLeft'});expect(screen.getByRole('tab',{name:/^Audio/})).toHaveAttribute('aria-selected','true');});
it('previews actual video metadata and revokes preview on reset',()=>{open();choose();const preview=screen.getByLabelText('Video preview');expect(preview).toHaveAttribute('src','blob:video');Object.defineProperty(preview,'duration',{configurable:true,value:2});fireEvent.loadedMetadata(preview);expect(screen.getByText(/2.00 seconds/)).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Remove video'}));expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:video');});
it('shows raw model assessment, actual timeline and clearly labelled threshold count',async()=>{upload();vi.mocked(pollVideoResult).mockResolvedValue(videoFixture() as Awaited<ReturnType<typeof pollVideoResult>>);open();choose();fireEvent.click(screen.getByRole('button',{name:'Analyze video'}));expect(await screen.findByRole('heading',{name:'WaveRep model assessment'})).toBeVisible();expect(screen.getByText('-1.0000')).toBeVisible();expect(screen.getByRole('heading',{name:'AI-generation signals detected'})).toBeVisible();expect(screen.getByText(/2 of 3 analyzed frames/)).toBeVisible();expect(screen.getByText(/not a calibrated authenticity probability/)).toBeVisible();expect(screen.getByRole('img',{name:/Raw LLR scores for all 3/})).toBeVisible();expect(screen.getByText(/Informational\/nonprofit portfolio demo only/)).toBeVisible();});
it('prevents duplicate uploads and mode switches; shows real progress only',async()=>{const mock=upload();let done!:(d:Awaited<ReturnType<typeof pollVideoResult>>)=>void;vi.mocked(pollVideoResult).mockImplementation((_,__,progress)=>{progress({processed_frames:1,total_frames:3});return new Promise(r=>done=r);});open();choose();const button=screen.getByRole('button',{name:'Analyze video'});fireEvent.click(button);fireEvent.click(button);expect(await screen.findByText('1 / 3 frames analyzed')).toBeVisible();expect(screen.getByRole('tab',{name:/^Image/})).toBeDisabled();expect(mock).toHaveBeenCalledTimes(1);done(videoFixture() as Awaited<ReturnType<typeof pollVideoResult>>);await screen.findByText('WaveRep model assessment');});
it('shows decoding failure without assessment',async()=>{upload();vi.mocked(pollVideoResult).mockRejectedValue(new Error('Invalid H.264 stream'));open();choose();fireEvent.click(screen.getByRole('button',{name:'Analyze video'}));expect(await screen.findByRole('alert')).toHaveTextContent('Invalid H.264 stream');expect(screen.queryByText('Mean frame LLR')).not.toBeInTheDocument();expect(cancelVideo).toHaveBeenCalled();});
it('rejects unsupported local files',()=>{open();fireEvent.drop(screen.getByText('Drop a video here').parentElement!,{dataTransfer:{files:[new File(['x'],'clip.mov',{type:'video/quicktime'})]}});expect(screen.getByRole('alert')).toHaveTextContent('MP4');});

it('does not call a video genuine when no frame crosses the published rule',async()=>{
 upload();const data=videoFixture();data.frames=data.frames.map(f=>({...f,llr:-1}));data.mean_llr=-1;data.sigmoid_mean_llr=1/(1+Math.exp(1));data.synthetic_frame_count=0;vi.mocked(pollVideoResult).mockResolvedValue(data as Awaited<ReturnType<typeof pollVideoResult>>);open();choose();fireEvent.click(screen.getByRole('button',{name:'Analyze video'}));expect(await screen.findByRole('heading',{name:'No AI-generation signals detected'})).toBeVisible();expect(screen.getByText(/does not establish that the video is genuine/)).toBeVisible();
});
it('uses the published frame threshold count even when the mean score is negative',async()=>{
 upload();vi.mocked(pollVideoResult).mockResolvedValue(videoFixture() as Awaited<ReturnType<typeof pollVideoResult>>);open();choose();fireEvent.click(screen.getByRole('button',{name:'Analyze video'}));expect(await screen.findByRole('heading',{name:'AI-generation signals detected'})).toBeVisible();expect(screen.getByText(/2 of 3 frames crossed/)).toBeVisible();expect(screen.queryByText(/^Genuine$/)).not.toBeInTheDocument();
});
it('renders only 50 frame rows and pages through a 7200-frame result without hiding local signals',async()=>{
 upload();const frames=Array.from({length:7200},(_,index)=>({index,timestamp:index/60,llr:index===3501?2:-1}));
 const mean=frames.reduce((s,f)=>s+f.llr,0)/frames.length;
 vi.mocked(pollVideoResult).mockResolvedValue({...videoFixture(),duration:120,frames,frame_count:7200,mean_llr:mean,sigmoid_mean_llr:1/(1+Math.exp(-mean)),synthetic_frame_count:1} as Awaited<ReturnType<typeof pollVideoResult>>);
 open();choose();fireEvent.click(screen.getByRole('button',{name:'Analyze video'}));
 expect(await screen.findByRole('heading',{name:'Localized AI-like signals'})).toBeVisible();
 expect(screen.getAllByRole('row',{hidden:true})).toHaveLength(51);
 fireEvent.click(screen.getByText('Inspect all 7200 frame scores'));
 fireEvent.click(screen.getByRole('button',{name:'Next frames'}));expect(screen.getByText('Page 2 of 144')).toBeVisible();
 fireEvent.click(screen.getByRole('checkbox',{name:'Only frames with LLR > 0'}));
 expect(screen.getAllByRole('row')).toHaveLength(2);expect(screen.getByRole('cell',{name:'3501'})).toBeVisible();
});
