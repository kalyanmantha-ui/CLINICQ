import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type Column } from './DataTable';
import { expectNoA11yViolations } from '../test/axe';

interface Row { id: number; name: string }
const rows: Row[] = Array.from({ length: 45 }, (_, i) => ({ id: i, name: `Person ${i + 1}` }));
const columns: Column<Row>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }];
const table = (n: number, pageSize?: number) => <DataTable caption="People" rows={rows.slice(0, n)} columns={columns} rowKey={(r) => String(r.id)} pageSize={pageSize} />;

describe('DataTable', () => {
  it('shows only one page of rows and pages forward', async () => {
    render(table(45, 20));
    expect(screen.getAllByRole('row')).toHaveLength(21);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Person 21')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('has no pager when everything fits on one page', () => {
    render(table(5, 20));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(table(45, 20));
    await expectNoA11yViolations(container);
  });
});
