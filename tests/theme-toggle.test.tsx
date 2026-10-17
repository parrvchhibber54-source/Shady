// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ThemeToggle from '../app/theme-toggle';
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:vi.fn((key:string)=>values.get(key)??null),setItem:vi.fn((key:string,value:string)=>values.set(key,value)),clear:()=>values.clear()});document.documentElement.dataset.theme='dark';});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('switches both ways and persists the chosen theme',()=>{
 render(<ThemeToggle/>);fireEvent.click(screen.getByRole('button',{name:'Switch to light mode'}));
 expect(document.documentElement.dataset.theme).toBe('light');expect(localStorage.getItem('shady-theme')).toBe('light');
 fireEvent.click(screen.getByRole('button',{name:'Switch to dark mode'}));expect(document.documentElement.dataset.theme).toBe('dark');
});
it('uses the pre-applied preference when mounting on another page',()=>{
 document.documentElement.dataset.theme='light';localStorage.setItem('shady-theme','light');
 render(<ThemeToggle/>);expect(screen.getByRole('button',{name:'Switch to dark mode'})).toBeVisible();
});
it('still switches when browser storage is blocked',()=>{
 vi.mocked(localStorage.setItem).mockImplementation(()=>{throw new Error('blocked');});
 render(<ThemeToggle/>);fireEvent.click(screen.getByRole('button',{name:'Switch to light mode'}));expect(document.documentElement.dataset.theme).toBe('light');
});
