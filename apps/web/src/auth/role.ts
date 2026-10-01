import type { RoleConfig } from '../config/flags';

export type Role = 'student' | 'teacher' | 'admin';

/**
 * 역할 판별 (FR-AUTH-006).
 * 기본값은 student 이고, 허용 목록이나 교직원 패턴에 맞을 때만 권한을 올린다.
 * Domain-wide Delegation / Admin SDK 조회는 쓰지 않는다.
 */
export function determineRole(email: string, config: RoleConfig): Role {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 'student';
  if (config.adminEmails.includes(normalized)) return 'admin';
  if (config.teacherEmails.includes(normalized)) return 'teacher';
  if (config.teacherEmailPattern) {
    try {
      if (new RegExp(config.teacherEmailPattern, 'i').test(normalized)) return 'teacher';
    } catch {
      // 잘못된 패턴은 무시하고 student 로 둔다
    }
  }
  return 'student';
}
