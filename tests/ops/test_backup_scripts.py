"""운영 DB에 연결하지 않고 백업/복구의 실패 종료와 원자적 공개를 검사한다."""
import gzip
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]

class BackupSafety(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ, PATH=f'{self.bin}:{os.environ["PATH"]}',
                        POSTGRES_USER='test', POSTGRES_DB='test', BACKUP_ONCE='1', BACKUP_DIR=str(self.base / 'backups'))

    def command(self, name, body):
        script = self.bin / name
        script.write_text('#!/bin/sh\n' + body)
        script.chmod(0o700)

    def run_script(self, name, *args):
        return subprocess.run(['bash', str(ROOT / 'deploy/backup' / name), *map(str, args)],
                              input='yes\n', text=True, capture_output=True, env=self.env)

    def test_failed_dump_is_not_published(self):
        self.command('pg_dump', 'echo partial-data\nexit 1\n')
        result = self.run_script('backup.sh')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(list((self.base / 'backups').iterdir()), [])

    def test_successful_dump_is_readable(self):
        self.command('pg_dump', 'echo "SELECT 1;"\n')
        result = self.run_script('backup.sh')
        self.assertEqual(result.returncode, 0, result.stderr)
        files = list((self.base / 'backups').glob('*.sql.gz'))
        self.assertEqual(len(files), 1)
        self.assertEqual(gzip.decompress(files[0].read_bytes()), b'SELECT 1;\n')

    def test_corrupt_archive_never_calls_database(self):
        marker = self.base / 'db-called'
        self.command('psql', f'touch "{marker}"\n')
        bad = self.base / 'bad.sql.gz'
        bad.write_bytes(b'broken')
        self.assertNotEqual(self.run_script('restore.sh', bad).returncode, 0)
        self.assertFalse(marker.exists())

    def test_sql_failure_is_not_reported_as_success(self):
        self.command('psql', 'exit 1\n')
        archive = self.base / 'valid.sql.gz'
        archive.write_bytes(gzip.compress(b'INVALID SQL;'))
        result = self.run_script('restore.sh', archive)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('[restore] 완료', result.stdout)

if __name__ == '__main__':
    unittest.main()
