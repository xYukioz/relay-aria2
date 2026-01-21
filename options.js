function save() {
    const enabled = document.getElementById('enabled').checked;
    const rpcUrl = document.getElementById('rpcUrl').value;
    const rpcToken = document.getElementById('rpcToken').value;
    const minSize = document.getElementById('minSize').value;
    const whitelist = document.getElementById('whitelist').value;
    const blacklist = document.getElementById('blacklist').value;
    const fileTypes = document.getElementById('fileTypes').value;
    const downloadDir = document.getElementById('downloadDir').value;
    const toastPosition = document.getElementById('toastPosition').value;

    chrome.storage.local.set({
      enabled: enabled,
      rpcUrl: rpcUrl,
      rpcToken: rpcToken,
      minSize: minSize,
      whitelist: whitelist,
      blacklist: blacklist,
      fileTypes: fileTypes,
      downloadDir: downloadDir,
      toastPosition: toastPosition
    }, () => {
      const status = document.getElementById('msg');
      status.textContent = 'saved.';
      render();
      checkConnection(rpcUrl, rpcToken);
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    });
  }

  function render() {
      const enabled = document.getElementById('enabled').checked;
      const text = document.getElementById('statusText');
      text.textContent = enabled ? "active" : "disabled";
      text.style.color = enabled ? "#00ff00" : "#ff0000";
  }

  function load() {
    chrome.storage.local.get({
      enabled: false,
      rpcUrl: 'http://localhost:6800/jsonrpc',
      rpcToken: 'SomethingSecure',
      minSize: '0',
      whitelist: '',
      blacklist: '',
      fileTypes: '',
      downloadDir: '',
      toastPosition: 'top-right'
    }, (items) => {
      document.getElementById('enabled').checked = items.enabled;
      document.getElementById('rpcUrl').value = items.rpcUrl;
      document.getElementById('rpcToken').value = items.rpcToken;
      document.getElementById('minSize').value = items.minSize;
      document.getElementById('whitelist').value = items.whitelist;
      document.getElementById('blacklist').value = items.blacklist;
      document.getElementById('fileTypes').value = items.fileTypes;
      document.getElementById('downloadDir').value = items.downloadDir;
      document.getElementById('toastPosition').value = items.toastPosition;

      render();
      checkConnection(items.rpcUrl, items.rpcToken);
    });
  }

  let debounceTimer;
  function checkConnection(url, token) {
      const statusSpan = document.getElementById('connectionStatus');
      statusSpan.textContent = "checking...";
      statusSpan.style.color = "#ffff00";
      statusSpan.style.backgroundColor = "transparent";
      statusSpan.title = "";

      const rpcData = {
        jsonrpc: "2.0",
        method: "aria2.getVersion",
        id: "check-" + Date.now(),
        params: token ? [`token:${token}`] : []
      };

      fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rpcData)
      })
      .then(res => res.json())
      .then(data => {
          if(data.result) {
              statusSpan.textContent = "connected";
              statusSpan.style.color = "#00ff00";
          } else {
              statusSpan.textContent = "error";
              statusSpan.style.color = "#ff0000";
          }
      })
      .catch(err => {
          console.error(err);
          statusSpan.textContent = "connection failed";
          statusSpan.style.color = "#ff0000";
      });
  }

  document.getElementById('enabled').addEventListener('change', render);

  function requestCheck() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
          checkConnection(
              document.getElementById('rpcUrl').value,
              document.getElementById('rpcToken').value
          );
      }, 500);
  }

  document.getElementById('rpcUrl').addEventListener('input', requestCheck);
  document.getElementById('rpcToken').addEventListener('input', requestCheck);

  document.addEventListener('DOMContentLoaded', load);
  document.getElementById('saveBtn').addEventListener('click', save);

  document.getElementById('exportBtn').addEventListener('click', () => {
      chrome.storage.local.get(null, (items) => {
          const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'relay-settings.json';
          a.click();
          URL.revokeObjectURL(url);

          const status = document.getElementById('msg');
          status.textContent = 'exported.';
          setTimeout(() => { status.textContent = ''; }, 2000);
      });
  });

  document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const settings = JSON.parse(event.target.result);
              chrome.storage.local.set(settings, () => {
                  load();
                  const status = document.getElementById('msg');
                  status.textContent = 'imported.';
                  setTimeout(() => { status.textContent = ''; }, 2000);
              });
          } catch (err) {
              const status = document.getElementById('msg');
              status.textContent = 'invalid file';
              status.style.color = '#ff0000';
              setTimeout(() => { status.textContent = ''; status.style.color = '#00ff00'; }, 3000);
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  });
