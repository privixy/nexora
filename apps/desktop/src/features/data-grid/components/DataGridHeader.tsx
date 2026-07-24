import { flexRender, type HeaderGroup } from "@tanstack/react-table";

interface DataGridHeaderProps {
  headerGroups: HeaderGroup<unknown[]>[];
  sticky: boolean;
  onSelectAll: () => void;
  onHeaderContextMenu: (
    event: React.MouseEvent,
    columnName: string,
  ) => void;
}

export function DataGridHeader({
  headerGroups,
  sticky,
  onSelectAll,
  onHeaderContextMenu,
}: DataGridHeaderProps) {
  return (
    <thead className={`bg-base z-10 shadow-sm ${sticky ? "sticky top-0" : ""}`}>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id}>
          <th
            onClick={onSelectAll}
            className="px-2 py-2 text-xs font-semibold text-muted border-b border-r border-default bg-base sticky left-0 z-20 text-center select-none w-[50px] min-w-[50px] cursor-pointer hover:bg-elevated"
          >
            #
          </th>
          {headerGroup.headers.map((header) => (
            <th
              key={header.id}
              className="px-4 py-2 text-xs font-semibold text-secondary tracking-wider border-b border-r border-default last:border-r-0 whitespace-nowrap"
              onContextMenu={(event) => onHeaderContextMenu(event, header.id)}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          ))}
        </tr>
      ))}
    </thead>
  );
}
