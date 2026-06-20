/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Table as AntTable } from 'antd';
import {
  TablePaginationConfig,
  TableProps as AntTableProps,
} from 'antd/es/table';
import classNames from 'classnames';
import { useResizeDetector } from 'react-resize-detector';
import React, { useRef, useState, useCallback, CSSProperties } from 'react';
import { Grid, type GridImperativeAPI } from 'react-window';
import { safeHtmlSpan } from '@superset-ui/core';
import { useTheme, styled } from '@apache-superset/core/theme';

import { TableSize, ETableAction } from './index';

export interface VirtualTableProps<
  RecordType,
> extends AntTableProps<RecordType> {
  height?: number;
  allowHTML?: boolean;
}

const StyledCell = styled('div')<{ height?: number }>(
  ({ theme, height }) => `
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: ${theme.sizeUnit * 2}px;
  padding-right: ${theme.sizeUnit}px;
  border-bottom: 1px solid ${theme.colorSplit};
  transition: background 0.3s;
  line-height: ${height}px;
  box-sizing: border-box;
`,
);

const StyledTable = styled(AntTable)(
  ({ theme }) => `
    th.ant-table-cell {
      font-weight: ${theme.fontWeightStrong};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .ant-spin-nested-loading .ant-spin .ant-spin-dot {
      width: ${theme.sizeUnit * 12}px;
      height: unset;
    }
`,
) as unknown as typeof AntTable;

const SMALL = 39;
const MIDDLE = 47;

const VirtualTable = <RecordType extends object>(
  props: VirtualTableProps<RecordType>,
) => {
  const {
    columns,
    pagination,
    onChange,
    height,
    scroll,
    size,
    allowHTML = false,
  } = props;
  const [tableWidth, setTableWidth] = useState<number>(0);
  const onResize = useCallback((width: number) => {
    setTableWidth(width);
  }, []);
  const { ref } = useResizeDetector({ onResize });
  const theme = useTheme();

  // If a column definition has no width, react-window will use this as the default column width
  const DEFAULT_COL_WIDTH = theme?.sizeUnit * 37 || 150;
  const widthColumnCount = columns!.filter(({ width }) => !width).length;
  let staticColWidthTotal = 0;
  columns?.forEach(column => {
    if (column.width) {
      staticColWidthTotal += column.width as number;
    }
  });

  let totalWidth = 0;
  const defaultWidth = Math.max(
    Math.floor((tableWidth - staticColWidthTotal) / widthColumnCount),
    50,
  );

  const mergedColumns =
    columns?.map?.(column => {
      const modifiedColumn = { ...column };
      if (!column.width) {
        modifiedColumn.width = defaultWidth;
      }
      totalWidth += modifiedColumn.width as number;
      return modifiedColumn;
    }) ?? [];

  /*
   * There are cases where a user could set the width of each column and the total width is less than width of
   * the table.  In this case we will stretch the last column to use the extra space
   */
  if (totalWidth < tableWidth) {
    const lastColumn = mergedColumns[mergedColumns.length - 1];
    lastColumn.width =
      (lastColumn.width as number) + Math.floor(tableWidth - totalWidth);
  }

  const gridRef = useRef<GridImperativeAPI>(null);
  const [connectObject] = useState(() => {
    const obj = {};
    Object.defineProperty(obj, 'scrollLeft', {
      get: () => gridRef.current?.element?.scrollLeft ?? 0,
      set: (scrollLeft: number) => {
        const el = gridRef.current?.element;
        if (el) {
          el.scrollLeft = scrollLeft;
        }
      },
    });

    return obj;
  });

  /*
   * antd Table has a runtime error when it tries to fire the onChange event triggered from a pageChange
   * when the table body is overridden with the virtualized table.  This function capture the page change event
   * from within the pagination controls and proxies the onChange event payload
   */
  const onPageChange = (page: number, size: number) => {
    /**
     * This resets vertical scroll position to 0 (top) when page changes
     * We intentionally leave horizontal scroll where it was so user can focus on
     * specific range of columns as they page through data
     */
    if (gridRef.current?.element) {
      gridRef.current.element.scrollTop = 0;
    }

    onChange?.(
      {
        ...pagination,
        current: page,
        pageSize: size,
      } as TablePaginationConfig,
      {},
      {},
      {
        action: ETableAction.Paginate,
        currentDataSource: [],
      },
    );
  };

  interface VirtualCellProps {
    rawData: readonly object[];
  }

  const VirtualCell = ({
    columnIndex,
    rowIndex,
    style,
    rawData,
  }: {
    columnIndex: number;
    rowIndex: number;
    style: CSSProperties;
    ariaAttributes: { 'aria-colindex': number; role: 'gridcell' };
  } & VirtualCellProps) => {
    const data = rawData?.[rowIndex] as Record<string, unknown> | undefined;
    let content =
      data?.[
        (mergedColumns as { dataIndex?: string }[])?.[columnIndex]
          ?.dataIndex as string
      ];
    const render = mergedColumns[columnIndex]?.render;
    if (typeof render === 'function') {
      content = render(content, data as RecordType, rowIndex);
    }

    if (allowHTML && typeof content === 'string') {
      content = safeHtmlSpan(content);
    }

    const cellSize = size === TableSize.Middle ? MIDDLE : SMALL;

    return (
      <StyledCell
        className={classNames('virtual-table-cell', {
          'virtual-table-cell-last': columnIndex === mergedColumns.length - 1,
        })}
        style={style}
        title={typeof content === 'string' ? content : undefined}
        theme={theme}
        height={cellSize}
      >
        {content as React.ReactNode}
      </StyledCell>
    );
  };

  const renderVirtualList: (
    rawData: readonly RecordType[],
    info: {
      ref: React.MutableRefObject<unknown>;
      onScroll: (info: { scrollLeft: number }) => void;
    },
  ) => React.ReactNode = (rawData, { ref: bodyRef, onScroll }) => {
    // eslint-disable-next-line no-param-reassign
    bodyRef.current = connectObject;
    const cellSize = size === TableSize.Middle ? MIDDLE : SMALL;
    return (
      <Grid
        gridRef={gridRef}
        className="virtual-grid"
        columnCount={mergedColumns.length}
        columnWidth={(index: number) => {
          const { width = DEFAULT_COL_WIDTH } = mergedColumns[index];
          return width as number;
        }}
        style={{ height: height || (scroll!.y as number), width: tableWidth }}
        rowCount={rawData.length}
        rowHeight={cellSize}
        cellComponent={VirtualCell}
        cellProps={{ rawData }}
        onScroll={(e: React.UIEvent<HTMLDivElement>) => {
          onScroll({ scrollLeft: (e.target as HTMLDivElement).scrollLeft });
        }}
      />
    );
  };

  const modifiedPagination = {
    ...pagination,
    onChange: onPageChange,
  };

  return (
    <div ref={ref}>
      <StyledTable
        {...props}
        sticky={false}
        className="virtual-table"
        components={{
          body: renderVirtualList,
        }}
        pagination={pagination ? modifiedPagination : false}
        scroll={scroll}
        columns={mergedColumns}
      />
    </div>
  );
};

export default VirtualTable;
