import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from './DataTable';
import { Pill } from './Pill';

interface Row { id: number; name: string; role: string }
const rows: Row[] = Array.from({ length: 45 }, (_, i) => ({ id: i, name: `Person ${i + 1}`, role: ['PATIENT', 'DOCTOR', 'RECEPTIONIST'][i % 3] }));

const meta: Meta = { title: 'Display/DataTable' };
export default meta;
export const Paged: StoryObj = {
  render: () => <DataTable caption="People" rows={rows} rowKey={(r) => String(r.id)} pageSize={10}
    columns={[{ key: 'n', header: 'Name', render: (r) => r.name }, { key: 'r', header: 'Role', render: (r) => <Pill tone="role">{r.role}</Pill> }]} />,
};
