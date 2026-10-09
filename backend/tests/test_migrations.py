"""
Models and Alembic migrations must describe the same schema.
This work made by Anfinogentov Nikita
"""
import os
import subprocess
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]


def test_no_pending_model_changes(settings):
    result = subprocess.run(["uv", "run", "alembic", "check"], cwd=backend_dir, env=os.environ.copy(), capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
