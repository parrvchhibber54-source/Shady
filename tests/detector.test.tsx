// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Detector from '../app/detector';
beforeEach(() => { window.matchMedia = vi.fn(() => ({matches:false, addEventListener:vi.fn(), removeEventListener:vi.fn()})) as unknown as typeof window.matchMedia; URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
function select() { fireEvent.change(screen.getByLabelText('Choose image'), { target: { files: [new File(['image'], 'photo.png', {type:'image/png'})] } }); }
it('shows unavailable status and never invents a result', () => { render(<Detector available={false}/>); expect(screen.getByRole('button', {name:'Analyze image'})).toBeDisabled(); expect(screen.getByText(/Live analysis unavailable/)).toBeVisible(); expect(screen.queryByRole('meter')).not.toBeInTheDocument(); });
it('previews, submits once, and displays actual confidence then resets', async () => { let finish!: (value: object)=>void; const mock = vi.fn(() => new Promise(r => {finish = r;})); vi.stubGlobal('fetch', mock); render(<Detector available/>); select(); expect(await screen.findByAltText('Preview of photo.png')).toBeVisible(); const button = screen.getByRole('button', {name:'Analyze image'}); fireEvent.click(button); fireEvent.click(button); expect(mock).toHaveBeenCalledTimes(1); expect(screen.getByRole('button', {name:/Analyzing image/})).toBeDisabled(); finish({ok:true, json:async () => ({score:.8234, operations:5})}); await waitFor(() => expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow','82.34')); expect(screen.getByText('82.3')).toBeVisible(); fireEvent.click(screen.getByRole('button', {name:'Remove image'})); expect(screen.queryByRole('meter')).not.toBeInTheDocument(); });
it('shows provider errors', async () => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:false, json:async () => ({error:'Quota exhausted'})})); render(<Detector available/>); select(); fireEvent.click(screen.getByRole('button', {name:'Analyze image'})); expect(await screen.findByRole('alert')).toHaveTextContent('Quota exhausted'); });
it('rejects invalid local files and supports drop upload', async () => {render(<Detector available/>); fireEvent.change(screen.getByLabelText('Choose image'), {target:{files:[new File(['text'],'text.txt',{type:'text/plain'})]}}); expect(screen.getByRole('alert')).toHaveTextContent('JPEG'); fireEvent.drop(screen.getByText('Drop an image here').parentElement!, {dataTransfer:{files:[new File(['image'],'dropped.png',{type:'image/png'})]}}); expect(await screen.findByAltText('Preview of dropped.png')).toBeVisible();});
it('shows a real magnified view only while analysis is pending', async () => {
 let finish!: (value:object)=>void; vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{finish=r;})));
 render(<Detector available/>); select();
 const preview=await screen.findByAltText('Preview of photo.png');fireEvent.load(preview);
 expect(screen.queryByTestId('zoom-lens')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Analyze image'}));
 expect(screen.getByTestId('zoom-lens')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Pause magnifier animation'}));
 expect(screen.getByRole('button',{name:'Resume magnifier animation'})).toBeInTheDocument();
 finish({ok:true,json:async()=>({score:.34,operations:5})});
 await waitFor(()=>expect(screen.queryByTestId('zoom-lens')).not.toBeInTheDocument());
 expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow','34');
});
