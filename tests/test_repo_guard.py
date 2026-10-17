"""Model-free publication checks against disposable Git indexes."""
import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('repo_guard', Path(__file__).resolve().parents[1] / 'scripts/check-repo.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

class PublicationGuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='shady-repo-guard-')
        self.root = Path(self.temp.name)
        subprocess.run(['git','init','-q',str(self.root)],check=True)
        self.patch = patch.object(guard,'ROOT',self.root)
        self.patch.start()
    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()
    def stage(self,*names):
        subprocess.run(['git','add','--',*names],cwd=self.root,check=True)
    def scan(self):
        output=io.StringIO()
        with contextlib.redirect_stdout(output): code=guard.check(staged=True)
        return code,output.getvalue()
    def test_blocks_staged_environment_file_without_disclosing_values(self):
        value='private-value-for-test-only'
        (self.root/'.env.local').write_text('EXAMPLE_SECRET='+value)
        self.stage('.env.local')
        code,text=self.scan()
        self.assertEqual(code,1)
        self.assertNotIn(value,text)
    def test_checks_staged_blob_instead_of_unstaged_worktree(self):
        (self.root/'note.txt').write_text('safe public note')
        self.stage('note.txt')
        (self.root/'note.txt').write_text('ghp_'+'a'*36)
        self.assertEqual(self.scan()[0],0)
        self.stage('note.txt')
        code,text=self.scan()
        self.assertEqual(code,1)
        self.assertNotIn('ghp_'+'a'*36,text)
    def test_checks_configured_values_without_printing_them(self):
        value='private-local-provider-value'
        (self.root/'.env.local').write_text('EXAMPLE_API_KEY='+value)
        (self.root/'note.txt').write_text(value)
        self.stage('note.txt')
        code,text=self.scan()
        self.assertEqual(code,1)
        self.assertNotIn(value,text)

if __name__=='__main__': unittest.main()
