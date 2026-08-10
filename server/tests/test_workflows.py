def test_create_workflow_requires_auth(client):
    resp = client.post("/workflows", json={"name": "Limpeza de clientes", "tags": ["vendas"], "steps": []})
    assert resp.status_code == 401


def test_create_and_list_workflow(client, auth_headers):
    headers = auth_headers("ana")
    payload = {
        "name": "Limpeza de clientes",
        "tags": ["vendas", "limpeza"],
        "steps": [{"id": "s1", "operation_type": "trim_whitespace", "params": {"columns": []}}],
    }
    created = client.post("/workflows", json=payload, headers=headers)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"] == "Limpeza de clientes"
    assert body["tags"] == ["vendas", "limpeza"]
    assert body["creator"]["username"] == "ana"
    assert len(body["steps"]) == 1

    listed = client.get("/workflows")
    assert listed.status_code == 200
    names = [w["name"] for w in listed.json()]
    assert "Limpeza de clientes" in names


def test_list_workflows_filters_by_tag(client, auth_headers):
    headers = auth_headers("ana")
    client.post("/workflows", json={"name": "A", "tags": ["vendas"], "steps": []}, headers=headers)
    client.post("/workflows", json={"name": "B", "tags": ["financeiro"], "steps": []}, headers=headers)

    resp = client.get("/workflows", params={"tag": "vendas"})
    names = [w["name"] for w in resp.json()]
    assert names == ["A"]


def test_workflow_tags_are_trimmed_and_deduplicated(client, auth_headers):
    headers = auth_headers("ana")
    resp = client.post(
        "/workflows", json={"name": "A", "tags": [" vendas ", "vendas", "", "  "], "steps": []}, headers=headers
    )
    assert resp.json()["tags"] == ["vendas"]


def test_get_single_workflow(client, auth_headers):
    headers = auth_headers("ana")
    created = client.post("/workflows", json={"name": "A", "tags": [], "steps": []}, headers=headers)
    workflow_id = created.json()["id"]

    resp = client.get(f"/workflows/{workflow_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == workflow_id


def test_get_missing_workflow_404s(client):
    resp = client.get("/workflows/does-not-exist")
    assert resp.status_code == 404


def test_only_creator_can_delete_workflow(client, auth_headers):
    ana_headers = auth_headers("ana")
    bruno_headers = auth_headers("bruno")
    created = client.post("/workflows", json={"name": "A", "tags": [], "steps": []}, headers=ana_headers)
    workflow_id = created.json()["id"]

    forbidden = client.delete(f"/workflows/{workflow_id}", headers=bruno_headers)
    assert forbidden.status_code == 403

    allowed = client.delete(f"/workflows/{workflow_id}", headers=ana_headers)
    assert allowed.status_code == 204

    assert client.get(f"/workflows/{workflow_id}").status_code == 404
