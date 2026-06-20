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

import '@testing-library/jest-dom';
import { render, fireEvent } from '@testing-library/react';
import ReactCountryMap from '../src/ReactCountryMap';

type PathFn = ((feature: unknown) => string) & {
  projection: jest.Mock;
  bounds: jest.Mock<[[number, number], [number, number]]>;
  centroid: jest.Mock<[number, number]>;
};

const mockPath: PathFn = jest.fn(() => 'M10 10 L20 20') as unknown as PathFn;
mockPath.projection = jest.fn();
mockPath.bounds = jest.fn(() => [
  [0, 0],
  [100, 100],
]);
mockPath.centroid = jest.fn(() => [50, 50]);

type Projection = ((...args: unknown[]) => void) & {
  scale: () => Projection;
  center: () => Projection;
  translate: () => Projection;
};

jest.mock('d3-geo', () => ({
  geoPath: () => mockPath,
  geoCentroid: jest.fn(() => [0, 0]),
  geoMercator: () => {
    const proj = (() => {}) as unknown as Projection;
    proj.scale = () => proj;
    proj.center = () => proj;
    proj.translate = () => proj;
    return proj;
  },
}));

jest.mock('d3-selection', () => {
  const actual = jest.requireActual('d3-selection');
  return {
    ...actual,
    pointer: jest.fn(() => [100, 50]),
  };
});

const mockD3Json = jest.fn();
jest.mock('d3-fetch', () => ({
  json: (...args: unknown[]) => mockD3Json(...args),
}));

const mockMapData = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { ISO: 'CAN', NAME_1: 'Canada' },
      geometry: {},
    },
  ],
};

describe('CountryMap (d3 v7 modular)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders a map after d3Json loads data', async () => {
    mockD3Json.mockResolvedValue(mockMapData);

    render(
      <ReactCountryMap
        width={500}
        height={300}
        data={[{ country_id: 'CAN', metric: 100 }]}
        country="canada"
        linearColorScheme="bnbColors"
        colorScheme=""
        numberFormat=".2f"
        formatter={jest.fn().mockReturnValue('100')}
      />,
    );

    expect(mockD3Json).toHaveBeenCalledTimes(1);

    // Wait for the promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    const region = document.querySelector('path.region');
    expect(region).not.toBeNull();
  });

  test('shows tooltip on mouseenter/mouseout', async () => {
    mockD3Json.mockResolvedValue(mockMapData);

    render(
      <ReactCountryMap
        width={500}
        height={300}
        data={[{ country_id: 'CAN', metric: 100 }]}
        country="canada"
        linearColorScheme="bnbColors"
        colorScheme=""
        formatter={jest.fn().mockReturnValue('100')}
      />,
    );

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    const region = document.querySelector('path.region');
    expect(region).not.toBeNull();

    const popup = document.querySelector('.hover-popup');
    expect(popup).not.toBeNull();

    fireEvent.mouseEnter(region!);
    expect(popup!).toHaveStyle({ display: 'block' });

    fireEvent.mouseOut(region!);
    expect(popup!).toHaveStyle({ display: 'none' });
  });
});
