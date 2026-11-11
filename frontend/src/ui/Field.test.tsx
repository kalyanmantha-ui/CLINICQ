import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField, TextAreaField, TextField } from './Field';
import { expectNoA11yViolations } from '../test/axe';

describe('form fields', () => {
  it('connects the label to the control', async () => {
    const onChange = vi.fn();
    render(<TextField label="Phone" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Phone'), '4');
    expect(onChange).toHaveBeenCalled();
  });

  it('links a hint to the control', () => {
    render(<TextField label="Password" hint="At least 8 characters." />);
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 8 characters.');
  });

  it('shows an error instead of the hint, marks the control invalid and announces it', () => {
    render(<TextField label="Email" hint="We never share it." error="Enter a valid email." />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Enter a valid email.');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email.');
    expect(screen.queryByText('We never share it.')).not.toBeInTheDocument();
  });

  it('works for selects and text areas', async () => {
    render(<><SelectField label="Role" defaultValue="B"><option value="A">A</option><option value="B">B</option></SelectField><TextAreaField label="Notes" /></>);
    expect(screen.getByLabelText('Role')).toHaveValue('B');
    await userEvent.type(screen.getByLabelText('Notes'), 'hello');
    expect(screen.getByLabelText('Notes')).toHaveValue('hello');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<form><TextField label="Name" hint="As on your ID" /><SelectField label="Role"><option>One</option></SelectField></form>);
    await expectNoA11yViolations(container);
  });
});
