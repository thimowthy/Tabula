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


def test_only_creator_or_admin_can_delete_workflow(client, auth_headers, make_admin):
    ana_headers = auth_headers("ana")
    bruno_headers = auth_headers("bruno")
    created = client.post("/workflows", json={"name": "A", "tags": [], "steps": []}, headers=ana_headers)
    workflow_id = created.json()["id"]

    forbidden = client.delete(f"/workflows/{workflow_id}", headers=bruno_headers)
    assert forbidden.status_code == 403

    allowed = client.delete(f"/workflows/{workflow_id}", headers=ana_headers)
    assert allowed.status_code == 204

    assert client.get(f"/workflows/{workflow_id}").status_code == 404


def test_admin_can_delete_workflow_created_by_someone_else(client, auth_headers, make_admin):
    ana_headers = auth_headers("ana")
    root_headers = auth_headers("root")
    make_admin("root")

    created = client.post("/workflows", json={"name": "A", "tags": [], "steps": []}, headers=ana_headers)
    workflow_id = created.json()["id"]

    resp = client.delete(f"/workflows/{workflow_id}", headers=root_headers)
    assert resp.status_code == 204
    assert client.get(f"/workflows/{workflow_id}").status_code == 404


def test_update_workflow_requires_auth(client, auth_headers):
    ana_headers = auth_headers("ana")
    created = client.post("/workflows", json={"name": "A", "tags": [], "steps": []}, headers=ana_headers)
    workflow_id = created.json()["id"]

    resp = client.put(f"/workflows/{workflow_id}", json={"name": "B", "tags": [], "steps": []})
    assert resp.status_code == 401


def test_anyone_signed_in_can_edit_any_workflow(client, auth_headers):
    ana_headers = auth_headers("ana")
    bruno_headers = auth_headers("bruno")
    created = client.post("/workflows", json={"name": "A", "tags": ["x"], "steps": []}, headers=ana_headers)
    workflow_id = created.json()["id"]
    assert created.json()["version"] == 1

    resp = client.put(
        f"/workflows/{workflow_id}",
        json={"name": "A editado", "tags": ["x", "y"], "steps": [], "changelog": "ajustei as tags"},
        headers=bruno_headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["name"] == "A editado"
    assert body["tags"] == ["x", "y"]
    assert body["version"] == 2
    # creator stays the original publisher even though bruno made the edit
    assert body["creator"]["username"] == "ana"


def test_editing_workflow_appends_a_version_and_keeps_history(client, auth_headers):
    ana_headers = auth_headers("ana")
    bruno_headers = auth_headers("bruno")
    created = client.post(
        "/workflows",
        json={"name": "A", "tags": [], "steps": [{"id": "s1", "operation_type": "trim_whitespace", "params": {}}]},
        headers=ana_headers,
    )
    workflow_id = created.json()["id"]

    client.put(
        f"/workflows/{workflow_id}",
        json={"name": "A v2", "tags": [], "steps": [], "changelog": "removi a etapa"},
        headers=bruno_headers,
    )

    versions = client.get(f"/workflows/{workflow_id}/versions")
    assert versions.status_code == 200
    body = versions.json()
    assert [v["version"] for v in body] == [2, 1]
    assert body[0]["changelog"] == "removi a etapa"
    assert body[0]["editor"]["username"] == "bruno"
    assert body[1]["editor"]["username"] == "ana"
    assert len(body[1]["steps"]) == 1

    v1 = client.get(f"/workflows/{workflow_id}/versions/1")
    assert v1.status_code == 200
    assert v1.json()["name"] == "A"

    missing = client.get(f"/workflows/{workflow_id}/versions/99")
    assert missing.status_code == 404


def test_update_missing_workflow_404s(client, auth_headers):
    headers = auth_headers("ana")
    resp = client.put("/workflows/does-not-exist", json={"name": "A", "tags": [], "steps": []}, headers=headers)
    assert resp.status_code == 404


def test_favorite_requires_auth(client, auth_headers):
    ana_headers = auth_headers("ana")
    created = client.post("/workflows", json={"name": "A", "tags": [], "steps": []}, headers=ana_headers)
    workflow_id = created.json()["id"]

    resp = client.post(f"/workflows/{workflow_id}/favorite")
    assert resp.status_code == 401


def test_favorite_is_personal_and_toggleable(client, auth_headers):
    ana_headers = auth_headers("ana")
    bruno_headers = auth_headers("bruno")
    created = client.post("/workflows", json={"name": "A", "tags": [], "steps": []}, headers=ana_headers)
    workflow_id = created.json()["id"]

    fav = client.post(f"/workflows/{workflow_id}/favorite", headers=bruno_headers)
    assert fav.status_code == 200, fav.text
    assert fav.json()["is_favorite"] is True

    # Favoriting again is a no-op, not an error.
    fav_again = client.post(f"/workflows/{workflow_id}/favorite", headers=bruno_headers)
    assert fav_again.status_code == 200
    assert fav_again.json()["is_favorite"] is True

    # It's bruno's favorite, not ana's, and not visible to anonymous callers.
    listed_bruno = client.get("/workflows", headers=bruno_headers)
    assert next(w for w in listed_bruno.json() if w["id"] == workflow_id)["is_favorite"] is True
    listed_ana = client.get("/workflows", headers=ana_headers)
    assert next(w for w in listed_ana.json() if w["id"] == workflow_id)["is_favorite"] is False
    listed_anon = client.get("/workflows")
    assert next(w for w in listed_anon.json() if w["id"] == workflow_id)["is_favorite"] is False

    unfav = client.delete(f"/workflows/{workflow_id}/favorite", headers=bruno_headers)
    assert unfav.status_code == 200
    assert unfav.json()["is_favorite"] is False

    # Unfavoriting again is also a no-op.
    unfav_again = client.delete(f"/workflows/{workflow_id}/favorite", headers=bruno_headers)
    assert unfav_again.status_code == 200
    assert unfav_again.json()["is_favorite"] is False


def test_favorite_missing_workflow_404s(client, auth_headers):
    headers = auth_headers("ana")
    resp = client.post("/workflows/does-not-exist/favorite", headers=headers)
    assert resp.status_code == 404
