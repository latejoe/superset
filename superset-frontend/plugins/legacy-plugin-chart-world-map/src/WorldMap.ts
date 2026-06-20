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
// @ts-nocheck
/* eslint-disable react/sort-prop-types */
import PropTypes from 'prop-types';
import { extent as d3Extent } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { select, selectAll } from 'd3-selection';
import {
  getSequentialSchemeRegistry,
  CategoricalColorNamespace,
  ValueFormatter,
} from '@superset-ui/core';
import Datamap from 'datamaps/dist/datamaps.all.min';
import { ColorBy } from './utils';

interface WorldMapDataEntry {
  country: string;
  code: string;
  latitude: number;
  longitude: number;
  name: string;
  m1: number;
  m2: number;
}

interface ProcessedDataEntry extends WorldMapDataEntry {
  radius: number;
  fillColor: string;
}

interface WorldMapFilterState {
  selectedValues?: string[];
  [key: string]: unknown;
}

export interface WorldMapProps {
  countryFieldtype: string;
  entity: string;
  data: WorldMapDataEntry[];
  width: number;
  height: number;
  maxBubbleSize: number;
  showBubbles: boolean;
  linearColorScheme: string;
  color: string;
  colorBy: ColorBy;
  colorScheme: string;
  sliceId: number;
  theme: Record<string, unknown>;
  onContextMenu: (
    x: number,
    y: number,
    payload: Record<string, unknown>,
  ) => void;
  setDataMask: (dataMask: Record<string, unknown>) => void;
  inContextMenu: boolean;
  filterState: WorldMapFilterState;
  emitCrossFilters: boolean;
  formatter: ValueFormatter;
}

interface DatamapSource {
  id?: string;
  country?: string;
}

const propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      country: PropTypes.string,
      code: PropTypes.string,
      latitude: PropTypes.number,
      longitude: PropTypes.number,
      name: PropTypes.string,
      m1: PropTypes.number,
      m2: PropTypes.number,
    }),
  ),
  height: PropTypes.number,
  maxBubbleSize: PropTypes.number,
  showBubbles: PropTypes.bool,
  linearColorScheme: PropTypes.string,
  color: PropTypes.string,
  colorScheme: PropTypes.string,
  setDataMask: PropTypes.func,
  onContextMenu: PropTypes.func,
  emitCrossFilters: PropTypes.bool,
  formatter: PropTypes.object,
};

function WorldMap(element: HTMLElement, props: WorldMapProps): void {
  const {
    countryFieldtype,
    entity,
    data,
    width,
    height,
    maxBubbleSize,
    showBubbles,
    linearColorScheme,
    color,
    colorBy,
    colorScheme,
    sliceId,
    theme,
    onContextMenu,
    setDataMask,
    inContextMenu,
    filterState,
    emitCrossFilters,
    formatter,
  } = props;
  const div = select(element);
  div.classed('superset-legacy-chart-world-map', true);
  div.selectAll('*').remove();

  // Ignore XXX's to get better normalization
  const filteredData = data.filter(d => d.country && d.country !== 'XXX');

  const extRadius = d3Extent(filteredData, d => Math.sqrt(d.m2));
  const radiusScale = scaleLinear()
    .domain([extRadius[0] ?? 0, extRadius[1] ?? 0])
    .range([1, maxBubbleSize]);

  let processedData;
  let colorFn;
  if (colorBy === ColorBy.Country) {
    colorFn = CategoricalColorNamespace.getScale(colorScheme);

    processedData = filteredData.map(d => ({
      ...d,
      radius: radiusScale(Math.sqrt(d.m2)),
      fillColor: colorFn(d.name, sliceId),
    }));
  } else {
    const colorableData = filteredData.filter(d => d.m1 != null);
    const rawExtents = d3Extent(colorableData, d => d.m1);
    const extents: [number, number] =
      rawExtents[0] != null && rawExtents[1] != null
        ? [rawExtents[0], rawExtents[1]]
        : [0, 1];
    const colorSchemeObj = getSequentialSchemeRegistry().get(linearColorScheme);
    colorFn = colorSchemeObj
      ? colorSchemeObj.createLinearScale(extents)
      : () => theme.colorBorder;

    processedData = filteredData.map(d => ({
      ...d,
      radius: radiusScale(Math.sqrt(d.m2)),
      fillColor:
        d.m1 != null ? (colorFn(d.m1) ?? theme.colorBorder) : theme.colorBorder,
    }));
  }

  const mapData: Record<string, ProcessedDataEntry> = {};
  processedData.forEach(d => {
    mapData[d.country] = d;
  });

  const getCrossFilterDataMask = (source: DatamapSource) => {
    const selected = Object.values(filterState.selectedValues || {});
    const key = source.id || source.country;
    const country =
      countryFieldtype === 'name' ? mapData[key]?.name : mapData[key]?.code;

    if (!country) {
      return undefined;
    }

    let values;
    if (selected.includes(key)) {
      values = [];
    } else {
      values = [country];
    }

    return {
      dataMask: {
        extraFormData: {
          filters: values.length
            ? [
                {
                  col: entity,
                  op: 'IN',
                  val: values,
                },
              ]
            : [],
        },
        filterState: {
          value: values.length ? values : null,
          selectedValues: values.length ? [key] : null,
        },
      },
      isCurrentValueSelected: selected.includes(key),
    };
  };

  const handleClick = (source: DatamapSource, nativeEvent?: Event) => {
    if (!emitCrossFilters) {
      return;
    }
    const pointerEvent = nativeEvent || window.event;
    if (pointerEvent) {
      pointerEvent.preventDefault();
    }
    getCrossFilterDataMask(source);

    const dataMask = getCrossFilterDataMask(source)?.dataMask;
    if (dataMask) {
      setDataMask(dataMask);
    }
  };

  const handleContextMenu = (source: DatamapSource, nativeEvent?: Event) => {
    const pointerEvent = (nativeEvent || window.event) as MouseEvent;
    if (pointerEvent) {
      pointerEvent.preventDefault();
    }
    const key = source.id || source.country;
    const val =
      countryFieldtype === 'name' ? mapData[key]?.name : mapData[key]?.code;
    let drillToDetailFilters;
    let drillByFilters;
    if (val) {
      drillToDetailFilters = [
        {
          col: entity,
          op: '==',
          val,
          formattedVal: val,
        },
      ];
      drillByFilters = [
        {
          col: entity,
          op: '==',
          val,
        },
      ];
    }
    if (onContextMenu && pointerEvent) {
      onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
        drillToDetail: drillToDetailFilters,
        crossFilter: getCrossFilterDataMask(source),
        drillBy: { filters: drillByFilters, groupbyFieldName: 'entity' },
      });
    }
  };

  const map = new Datamap({
    element,
    width,
    height,
    data: mapData,
    fills: {
      defaultFill: theme.colorBorder,
    },
    geographyConfig: {
      popupOnHover: !inContextMenu,
      highlightOnHover: !inContextMenu,
      borderWidth: 1,
      borderColor: theme.colorSplit,
      highlightBorderColor: theme.colorIcon,
      highlightFillColor: color,
      highlightBorderWidth: 1,
      popupTemplate: (geo, d) =>
        d &&
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(
          d.m1,
        )}</div>`,
    },
    bubblesConfig: {
      borderWidth: 1,
      borderOpacity: 1,
      borderColor: color,
      popupOnHover: !inContextMenu,
      radius: null,
      popupTemplate: (geo, d) =>
        `<div class="hoverinfo"><strong>${d.name}</strong><br>${formatter(
          d.m2,
        )}</div>`,
      fillOpacity: 0.5,
      animate: true,
      highlightOnHover: !inContextMenu,
      highlightFillColor: color,
      highlightBorderColor: theme.colorTextSecondary,
      highlightBorderWidth: 2,
      highlightBorderOpacity: 1,
      highlightFillOpacity: 0.85,
      exitDelay: 100,
      key: JSON.stringify,
    },
    done: datamap => {
      datamap.svg
        .selectAll('.datamaps-subunit')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('contextmenu', (d: any) => {
          handleContextMenu(d);
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on('click', (d: any) => {
          handleClick(d);
        })
        // Use namespaced events to avoid overriding Datamaps' default tooltip handlers
        .on('mouseover.fillPreserve', function onMouseOver(this: Element) {
          if (inContextMenu) {
            return;
          }
          const el = select(this);
          const classes = el.attr('class') || '';
          const countryId = classes.split(' ')[1];
          const countryData = mapData[countryId];
          const originalFill =
            (countryData && countryData.fillColor) || theme.colorBorder;
          el.attr('data-original-fill', originalFill);
        })
        .on('mouseout.fillPreserve', function onMouseOut(this: Element) {
          if (inContextMenu) {
            return;
          }
          const el = select(this);
          const originalFill = el.attr('data-original-fill');
          if (originalFill) {
            el.style('fill', originalFill);
            el.attr('data-original-fill', null);
          }
        });
    },
  });

  map.updateChoropleth(mapData);

  if (showBubbles) {
    map.bubbles(processedData);
    div
      .selectAll('circle.datamaps-bubble')
      .style('fill', color)
      .style('stroke', color)
      .on('contextmenu', (_event: Event, d: DatamapSource) => {
        handleContextMenu(d, _event);
      })
      .on('click', (_event: Event, d: DatamapSource) => {
        handleClick(d, _event);
      });
  }

  if (filterState.selectedValues?.length > 0) {
    selectAll('path.datamaps-subunit')
      .filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (countryFeature: any) =>
          !filterState.selectedValues!.includes(countryFeature.id),
      )
      .style('fill-opacity', 0.35);

    filterState.selectedValues.forEach(value => {
      select(`path.datamaps-subunit.${value}`).style(
        'fill',
        mapData[value]?.fillColor,
      );
    });
  }
}

WorldMap.displayName = 'WorldMap';
WorldMap.propTypes = propTypes;

export default WorldMap;
