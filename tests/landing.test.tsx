// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Page from '../app/page';
afterEach(cleanup);
it('links Get started to the separate detector with no extra top navigation',()=>{
 render(<Page/>);expect(screen.getByRole('link',{name:'Get started'})).toHaveAttribute('href','/analyze');
 expect(screen.getAllByText('SHADY').length).toBe(2);
 expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Analyze image'})).not.toBeInTheDocument();
 expect(screen.queryByRole('meter')).not.toBeInTheDocument();
});
