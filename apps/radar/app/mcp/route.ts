import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { listSignals, getSignal } from '@/lib/radar';

// Read-only MCP interface for external agents and research environments
const handler = createMcpHandler(
  (server) => {
    // 1. Tool: radar_search
    server.registerTool(
      'radar_search',
      {
        description:
          'Search curated educational innovation signals in the BeLEARN AI Education Innovation Radar by keyword, pedagogy, geography, or tags. Returns structured metadata with decoupled novelty, maturity and evidence dimensions.',
        inputSchema: {
          query: z
            .string()
            .default('')
            .describe('Search query keyword (e.g., "living lab", "Switzerland", "assessment", "primary")'),
          country_code: z
            .string()
            .optional()
            .describe('Optional 2-letter ISO country code (e.g., "CH", "US", "SG", "FI")'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(20)
            .describe('Maximum number of signals to return')
        }
      },
      async ({ query, country_code, limit }) => {
        const q = (query || '').toLowerCase().trim();
        const all = await listSignals(100);
        const filtered = all.filter((s) => {
          if (country_code && s.country_code?.toUpperCase() !== country_code.toUpperCase()) {
            return false;
          }
          if (!q) return true;
          const haystack = `${s.title} ${s.summary} ${s.educational_problem || ''} ${s.country || ''} ${s.tags?.join(' ') || ''}`.toLowerCase();
          return haystack.includes(q);
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(filtered.slice(0, limit), null, 2)
            }
          ]
        };
      }
    );

    // 2. Tool: radar_get_profile
    server.registerTool(
      'radar_get_profile',
      {
        description:
          'Retrieve one comprehensive, structured Innovation Profile by signal ID. Provides strictly separated layers: empirical evidence, limitations, AI extraction, and Swiss exploratory application hypotheses.',
        inputSchema: {
          id: z.string().describe('The unique identifier of the signal (e.g., "demo-1", "demo-4")')
        }
      },
      async ({ id }) => {
        const row = await getSignal(id);
        if (!row) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Signal not found', id })
              }
            ],
            isError: true
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(row, null, 2)
            }
          ]
        };
      }
    );

    // 3. Tool: radar_latest
    server.registerTool(
      'radar_latest',
      {
        description:
          'Return the most recently discovered educational innovation signals logged in the AI Education Innovation Radar repository.',
        inputSchema: {
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(10)
            .describe('Number of recent signals to retrieve')
        }
      },
      async ({ limit }) => {
        const signals = await listSignals(limit);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(signals, null, 2)
            }
          ]
        };
      }
    );
  },
  {
    serverInfo: {
      name: 'belearn-education-innovation-radar-mcp',
      version: '0.2.0'
    },
    verboseLogs: false
  }
);

export { handler as GET, handler as POST, handler as DELETE };

export const maxDuration = 60;
