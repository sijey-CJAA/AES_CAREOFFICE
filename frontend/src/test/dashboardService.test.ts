import { describe, expect, it, vi } from 'vitest';
import { getSupabaseClient } from '../lib/supabase';
import { fetchDashboardStats } from '../services/dashboardService';

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

describe('fetchDashboardStats', () => {
  it('deduplicates multiple assessments and cases per student when using fallback queries', async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === 'case_students') {
        return {
          select: () => ({
            is: () => ({
              is: () =>
                Promise.resolve({
                  data: [{ student_id: 1 }, { student_id: 1 }, { student_id: 3 }],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'assessment_records') {
        return {
          select: () => ({
            is: () => ({
              is: () =>
                Promise.resolve({
                  data: [
                    { student_id: 1 },
                    { student_id: 1 },
                    { student_id: 1 },
                    { student_id: 2 },
                    { student_id: 2 },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'grade_sections') {
        return {
          select: () => Promise.resolve({ count: 26, error: null }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    vi.mocked(getSupabaseClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          total_students: 27,
          total_parents: 25,
          total_assessments: 5, // legacy row count before upgrade
          total_cases: 2,
        },
        error: null,
      }),
      from: mockFrom,
    } as any);

    const stats = await fetchDashboardStats();

    expect(stats).toEqual({
      total_students: 27,
      total_parents: 25,
      total_assessments: 2, // students 1 & 2 (even though student 1 has 3 and student 2 has 2)
      total_cases: 2,
      flagged_students: 3, // union of {1, 3} and {1, 2} => {1, 2, 3}
      total_sections: 26,
    });
  });

  it('uses upgraded RPC counts directly without extra queries', async () => {
    const mockFrom = vi.fn();
    vi.mocked(getSupabaseClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          total_students: 27,
          total_parents: 25,
          total_assessments: 2,
          total_cases: 2,
          flagged_students: 3,
          total_sections: 26,
        },
        error: null,
      }),
      from: mockFrom,
    } as any);

    const stats = await fetchDashboardStats();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(stats.total_assessments).toBe(2);
    expect(stats.flagged_students).toBe(3);
    expect(stats.total_sections).toBe(26);
  });
});

