import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { expectNoA11yViolations } from '../test/axe';

describe('Button', () => {
  it('maps variants to the class names the stylesheet uses', () => {
    render(<><Button>Plain</Button><Button variant="primary">Go</Button><Button variant="danger">Delete</Button></>);
    expect(screen.getByRole('button', { name: 'Plain' })).not.toHaveAttribute('class');
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('primary');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('danger');
  });

  it('blocks clicks and announces busy while an action is running', async () => {
    const onClick = vi.fn();
    render(<Button busy onClick={onClick}>Save</Button>);
    const b = screen.getByRole('button', { name: 'Save' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires onClick and forwards a ref', async () => {
    const onClick = vi.fn();
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref} onClick={onClick}>Press</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Press' }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Button variant="primary">Book</Button>);
    await expectNoA11yViolations(container);
  });
});
