import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build_extension', ROOT / 'scripts/build_extension.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BuildTests(unittest.TestCase):
    def test_release_origins_permissions_and_csp_match(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'extension.zip'
            builder.build('https://api.example.org/api/v1', 'https://app.example.org', True, output)
            with zipfile.ZipFile(output) as archive:
                manifest = json.loads(archive.read('manifest.json'))
                config = archive.read('config.js').decode()
                self.assertEqual(manifest['host_permissions'], ['https://api.example.org/*', 'https://app.example.org/*'])
                self.assertEqual(manifest['content_scripts'][0]['matches'], ['https://app.example.org/*'])
                self.assertIn('connect-src \'self\' https://api.example.org;', manifest['content_security_policy']['extension_pages'])
                self.assertIn('ENVIRONMENT: "production"', config)
                self.assertNotIn('http://localhost:8000/api/v1', config)
                self.assertIn('scan.css', archive.namelist())

    def test_insecure_and_ambiguous_release_urls_are_rejected(self):
        for api, app in [('http://api.example.org', 'https://app.example.org'),
                         ('https://user:pass@api.example.org', 'https://app.example.org'),
                         ('https://api.example.org', 'https://app.example.org/path')]:
            with self.subTest(api=api), self.assertRaises(ValueError):
                builder.build(api, app, True, Path('/tmp/unused-baitlock.zip'))


if __name__ == '__main__':
    unittest.main()
