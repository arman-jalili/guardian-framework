# Python Code Patterns

> **Purpose:** Reusable Python patterns for Guardian projects.
> **Generic:** Adapt for your framework (FastAPI, Django, etc.).

---

## Error Handling

```python
# Custom exception classes
class ValidationError(Exception):
    def __init__(self, message: str, field: str):
        super().__init__(message)
        self.field = field

class ConfigError(Exception):
    pass

# Result type pattern (optional, for library code)
from dataclasses import dataclass
from typing import Generic, TypeVar, Union

T = TypeVar('T')
E = TypeVar('E')

@dataclass
class Ok(Generic[T]):
    value: T
    ok: bool = True

@dataclass
class Err(Generic[E]):
    error: E
    ok: bool = False

Result = Union[Ok[T], Err[E]]

def parse_config(input: str) -> Result[dict, ValidationError]:
    try:
        return Ok(json.loads(input))
    except json.JSONDecodeError:
        return Err(ValidationError("Invalid JSON", "config"))
```

---

## Tracing / Logging

```python
import logging
import structlog

# Structured logging
logger = structlog.get_logger()

def process_request(user_id: str, request_id: str):
    logger.info("Processing request", user_id=user_id, request_id=request_id)
    try:
        result = do_work()
        logger.info("Request complete", result=result)
    except Exception as e:
        logger.error("Request failed", error=str(e), exc_info=True)
        raise

# Standard logging alternative
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
```

---

## Cancellation / Cleanup

```python
import asyncio
from contextlib import asynccontextmanager

# Async cancellation
async def long_running_task(cancel_event: asyncio.Event):
    while not cancel_event.is_set():
        await do_work()
        await asyncio.sleep(1)

# Context manager for cleanup
@asynccontextmanager
async def managed_resource():
    resource = acquire_resource()
    try:
        yield resource
    finally:
        release_resource(resource)

# Usage
async def main():
    cancel_event = asyncio.Event()
    task = asyncio.create_task(long_running_task(cancel_event))

    # Cancel after timeout
    await asyncio.sleep(10)
    cancel_event.set()
    await task
```

---

## Atomic Writes

```python
import os
import tempfile

def atomic_write(filepath: str, content: str):
    # Write to temp file in same directory
    dir_path = os.path.dirname(filepath)
    with tempfile.NamedTemporaryFile(
        mode='w',
        dir=dir_path,
        delete=False,
        suffix='.tmp'
    ) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    # Atomic rename
    os.replace(tmp_path, filepath)
```

---

## Async Patterns

```python
import asyncio

# Parallel execution
async def parallel_tasks():
    results = await asyncio.gather(
        task_a(),
        task_b(),
        task_c()
    )
    return results

# Concurrent limit
async def concurrent_limit(tasks: list, limit: int):
    semaphore = asyncio.Semaphore(limit)

    async def bounded_task(task):
        async with semaphore:
            return await task()

    return await asyncio.gather(*[bounded_task(t) for t in tasks])
```

---

## Testing

```python
# pytest patterns
import pytest

def test_parse():
    result = parse("input")
    assert result.ok == True

@pytest.mark.asyncio
async def test_async_flow():
    result = await run_flow()
    assert result is not None

# Mocking
from unittest.mock import Mock, patch

@patch('module.dependency')
def test_with_mock(mock_dep):
    mock_dep.return_value = "mocked"
    result = use_dependency()
    assert result == "expected"
```

---

## Anti-Patterns (NEVER DO)

```python
# ❌ Bare except
try:
    do_work()
except:  # BAD - catches everything including KeyboardInterrupt
    pass

# ✅ Specific exception
try:
    do_work()
except ValueError as e:
    logger.error("Validation failed", error=e)
except Exception as e:
    logger.error("Unexpected error", error=e)

# ❌ Silent failures
def bad():
    result = risky_operation()
    if not result:
        return None  # BAD - no indication of failure

# ✅ Explicit error handling
def good():
    result = risky_operation()
    if not result.ok:
        raise ValidationError(result.error)
    return result.value

# ❌ Global state
config = {}  # BAD - mutable global

# ✅ Encapsulated state
class Config:
    def __init__(self):
        self._data = {}

    def get(self, key):
        return self._data.get(key)
```

---

## Build Commands

```bash
# Build
python -m build

# Install
pip install -e .

# Test
pytest

# Test with coverage
pytest --cov=.

# Lint
ruff check .

# Format
ruff format .

# Type check
mypy .

# Security audit
pip-audit
```

---

## Dependencies

```toml
# pyproject.toml
[project]
dependencies = [
    "structlog>=23.0.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "ruff>=0.1.0",
    "mypy>=1.0.0",
]
```