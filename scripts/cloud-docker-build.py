"""Build the local app behind the cloud proxy, preserving TLS verification."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

with tempfile.TemporaryDirectory(prefix='iresearch-docker-') as temporary:
    directory = Path(temporary)
    original = Path.home() / '.docker' / 'config.json'
    # Preserve proxy routing only. Do not extract or copy registry credentials.
    proxies = json.loads(original.read_text()).get('proxies', {}) if original.is_file() else {}
    config = directory / 'config.json'
    config.write_text(json.dumps({'proxies': proxies}))
    config.chmod(0o600)
    override = {'services': {'app': {'build': {'network': 'host'}}}}
    ca = os.environ.get('NODE_EXTRA_CA_CERTS')
    if ca and Path(ca).is_file():
        override['services']['app']['build']['secrets'] = ['corporate_ca']
        override['secrets'] = {'corporate_ca': {'file': ca}}
    overrides = directory / 'compose-build.json'
    overrides.write_text(json.dumps(override))
    result = subprocess.run(
        ['docker', 'compose', '-f', 'compose.yaml', '-f', str(overrides), 'build', 'app'],
        env={**os.environ, 'DOCKER_CONFIG': str(directory)},
        check=False,
    )
    raise SystemExit(result.returncode)
