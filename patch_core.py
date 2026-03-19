import json
import glob
import urllib.request
import urllib.parse
from time import sleep

files = glob.glob('public/data/hub/*.json')
updated = 0

for path in files:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # We need to use spotifyId to get the correct name from HUB_ARTISTS?
        # Actually, since we don't have python access to hub-artists.ts reliably,
        # we can just use the mapping, or rather, we can just patch it in TS, or
        # I can just write a Node script!
        
        pass
    except Exception as e:
        print(e)
