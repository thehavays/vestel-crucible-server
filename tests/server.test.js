import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Vestel Crucible MCP Server', () => {
  it('should have index.js entry point', () => {
    const indexPath = path.join(__dirname, '../index.js');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('should declare expected tools', () => {
    const code = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf-8');
    expect(code).toContain('name: "crucible_get_recent_reviews"');
    expect(code).toContain('name: "crucible_get_recent_commits"');
    expect(code).toContain('name: "crucible_get_file_diff"');
    expect(code).toContain('name: "crucible_get_review_details"');
  });
});
