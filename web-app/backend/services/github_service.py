import os
import requests
import base64

class GitHubService:
    def __init__(self, token=None):
        self.token = token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json"
        }
        if token:
            self.headers["Authorization"] = f"token {token}"

    def get_user(self):
        response = requests.get(f"{self.base_url}/user", headers=self.headers)
        return response.json() if response.status_code == 200 else None

    def list_repos(self):
        response = requests.get(f"{self.base_url}/user/repos?sort=updated&per_page=100", headers=self.headers)
        return response.json() if response.status_code == 200 else []

    def create_repo(self, name, private=False):
        data = {
            "name": name,
            "private": private,
            "auto_init": True
        }
        response = requests.post(f"{self.base_url}/user/repos", headers=self.headers, json=data)
        return response.json() if response.status_code == 201 else None

    def push_file(self, repo_full_name, path, content, commit_message):
        # 1. Get current file (if exists) to get the SHA
        url = f"{self.base_url}/repos/{repo_full_name}/contents/{path}"
        get_res = requests.get(url, headers=self.headers)
        
        sha = None
        if get_res.status_code == 200:
            sha = get_res.json().get('sha')
        
        # 2. Push content (base64 encoded)
        encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        data = {
            "message": commit_message,
            "content": encoded_content
        }
        if sha:
            data["sha"] = sha
            
        put_res = requests.put(url, headers=self.headers, json=data)
        return put_res.json() if put_res.status_code in [200, 201] else put_res.json()
