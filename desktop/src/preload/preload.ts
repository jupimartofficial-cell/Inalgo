import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('appConfig', {
  apiBaseUrl: 'http://127.0.0.1:8081/api/v1'
});
