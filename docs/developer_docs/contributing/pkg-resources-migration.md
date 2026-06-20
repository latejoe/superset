---
title: pkg_resources Migration Guide
sidebar_position: 9
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# pkg_resources Deprecation and Migration Guide

## Background

As of setuptools 81.0.0, the `pkg_resources` API is deprecated and will be removed. This affects several packages in the Python ecosystem.

## Current Status

**Migration complete.** The `setuptools<81` pin has been lifted. Superset requires `setuptools>=81`.

### Superset Codebase

The Superset codebase migrated away from `pkg_resources` to the modern `importlib.metadata` API:

- `superset/db_engine_specs/__init__.py` - Uses `from importlib.metadata import entry_points`
- All entry point loading uses the modern API

### Production Dependencies

All production dependencies are compatible with setuptools 81+.

## Migration Reference

The following pattern was used to replace `pkg_resources` calls:

**Old (deprecated):**
```python
import pkg_resources

version = pkg_resources.get_distribution("package_name").version
entry_points = pkg_resources.iter_entry_points("group_name")
```

**New (recommended):**
```python
from importlib.metadata import version, entry_points

pkg_version = version("package_name")
eps = entry_points(group="group_name")
```

## Action Items

### For Extension Developers
1. **Update your packages** to use `importlib.metadata` instead of `pkg_resources`
2. **Test with setuptools >= 81.0.0**

## References

- [setuptools pkg_resources deprecation notice](https://setuptools.pypa.io/en/latest/pkg_resources.html)
- [importlib.metadata documentation](https://docs.python.org/3/library/importlib.metadata.html)
- [Migration guide](https://setuptools.pypa.io/en/latest/deprecated/pkg_resources.html)
