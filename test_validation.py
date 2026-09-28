import requests, json
BASE='http://localhost:3000/api'
r = requests.post(f'{BASE}/auth/login', json={'username':'admin','password':'admin123'})
tk = r.json()['token']
H = {'Authorization': f'Bearer {tk}', 'Content-Type': 'application/json'}
users = requests.get(f'{BASE}/users', headers=H).json()
tp = next(u for u in users if u['role']=='manager')
TP, DEPT = tp['id'], tp['departments'][0]

tests = [
    ('endDate<startDate', {'name':'Test ngay sai','department':DEPT,'assigneeId':TP,'startDate':'2026-12-31','endDate':'2026-01-01'}, 400),
    ('completed+50%', {'name':'Test completed 50','department':DEPT,'assigneeId':TP,'status':'completed','progress':50}, 400),
    ('not_started+20%', {'name':'Test not_started 20','department':DEPT,'assigneeId':TP,'status':'not_started','progress':20}, 400),
    ('hop le', {'name':'Task hop le xyz','department':DEPT,'assigneeId':TP,'startDate':'2026-10-01','endDate':'2026-10-15','status':'in_progress','progress':30}, 201),
]
for label, body, expect in tests:
    r = requests.post(f'{BASE}/tasks', headers=H, json=body)
    mark = 'PASS' if r.status_code == expect else 'FAIL'
    print(f'[{mark}] {label}: expect {expect}, got {r.status_code}')

# Test SubTask
tasks = requests.get(f'{BASE}/tasks', headers=H).json()
nv = next(u for u in users if u['role']=='employee')
print()
print('=== SubTask tests ===')
st_body = {'name':'Sub hop le','assigneeId':nv['id'],'priority':'medium','progress':15,'status':'in_progress','results':'Dang lam'}
r = requests.post(f'{BASE}/tasks/{tasks[0]["id"]}/subtasks', headers=H, json=st_body)
print(f'SubTask OK: expect 201, got {r.status_code}')

st_bad = {'name':'Sub sai ngay','assigneeId':nv['id'],'startDate':'2026-12-31','endDate':'2026-01-01'}
r = requests.post(f'{BASE}/tasks/{tasks[0]["id"]}/subtasks', headers=H, json=st_bad)
print(f'SubTask bad date: expect 400, got {r.status_code}')
