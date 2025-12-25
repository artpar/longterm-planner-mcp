import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, existsSync } from 'fs';

describe('MCP Server Integration', () => {
  let serverProcess: ChildProcess;
  let testDir: string;
  let responseBuffer = '';

  function sendRequest(request: object): Promise<object> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      const requestStr = JSON.stringify(request) + '\n';

      const handler = (data: Buffer) => {
        responseBuffer += data.toString();
        const lines = responseBuffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line);
              clearTimeout(timeout);
              serverProcess.stdout?.off('data', handler);
              responseBuffer = lines.slice(i + 1).join('\n');
              resolve(response);
              return;
            } catch {
              // Not valid JSON, continue
            }
          }
        }
      };

      serverProcess.stdout?.on('data', handler);
      serverProcess.stdin?.write(requestStr);
    });
  }

  beforeEach(async () => {
    // Create temp directory for test database
    testDir = join(tmpdir(), `mcp-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    // Start the server
    const serverPath = join(process.cwd(), 'dist', 'index.js');
    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PLANNING_DB_PATH: join(testDir, 'test.db')
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to be ready (give it time to initialize)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 500); // Server ready after 500ms

      serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      serverProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  });

  afterEach(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should respond to initialize request', async () => {
    const response = await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    expect(response).toHaveProperty('result');
    expect((response as any).result.serverInfo.name).toBe('longterm-planner-mcp');
  });

  it('should list available tools', async () => {
    // Initialize first
    await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    // Send initialized notification
    serverProcess.stdin?.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }) + '\n');

    // List tools
    const response = await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });

    expect(response).toHaveProperty('result');
    const tools = (response as any).result.tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    // Check for specific tools
    const toolNames = tools.map((t: any) => t.name);
    expect(toolNames).toContain('create_plan');
    expect(toolNames).toContain('add_task');
  });

  it('should list available resources', async () => {
    // Initialize
    await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    serverProcess.stdin?.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }) + '\n');

    // List resources
    const response = await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/list',
      params: {}
    });

    expect(response).toHaveProperty('result');
    const resources = (response as any).result.resources;
    expect(Array.isArray(resources)).toBe(true);
    expect(resources.length).toBeGreaterThan(0);
  });

  it('should list available prompts', async () => {
    // Initialize
    await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    serverProcess.stdin?.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }) + '\n');

    // List prompts
    const response = await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'prompts/list',
      params: {}
    });

    expect(response).toHaveProperty('result');
    const prompts = (response as any).result.prompts;
    expect(Array.isArray(prompts)).toBe(true);
    expect(prompts.length).toBeGreaterThan(0);

    const promptNames = prompts.map((p: any) => p.name);
    expect(promptNames).toContain('plan_session');
    expect(promptNames).toContain('daily_standup');
  });

  it('should create a plan via tool call', async () => {
    // Initialize
    await sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });

    serverProcess.stdin?.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }) + '\n');

    // Create plan
    const response = await sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'create_plan',
        arguments: {
          projectPath: '/test/project',
          name: 'Integration Test Plan',
          description: 'A plan created during integration testing'
        }
      }
    });

    expect(response).toHaveProperty('result');
    const content = (response as any).result.content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0].type).toBe('text');

    // The response contains the plan data
    const responseText = content[0].text;
    expect(responseText).toContain('Integration Test Plan');
  });
});
