"""Shared JMAP management client for Stalwart's admin API (urn:stalwart:jmap)."""
import base64, json, os, urllib.request

ENDPOINT = os.environ.get("STALWART_ADMIN_URL", "http://127.0.0.1:3881/jmap/")


def load_env(path=None):
    # Resolve relative to this file so the scripts work from any checkout,
    # not only from /root/raymail.
    if path is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    env = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k] = v
    return env


def client(env):
    cred = base64.b64encode(
        f"{env.get('STALWART_ADMIN_USER','admin')}:{env['STALWART_ADMIN_PASSWORD']}".encode()
    ).decode()

    def call(method, args):
        req = urllib.request.Request(
            ENDPOINT,
            data=json.dumps({"using": ["urn:stalwart:jmap"],
                             "methodCalls": [[method, args, "0"]]}).encode(),
            headers={"Authorization": "Basic " + cred,
                     "Content-Type": "application/json"},
        )
        body = json.load(urllib.request.urlopen(req, timeout=90))
        return body["methodResponses"][0][1]

    return call
