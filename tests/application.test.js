import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateApplication, normalizePhone, upsertParticipant } from '../public/js/lib/application.js';

test('유효한 신청은 오류가 없다', () => {
  const res = validateApplication(
    {
      name: '김고방',
      phone: '010-1234-5678',
      blogUrl: 'https://blog.naver.com/gobang',
      agree: true,
    },
    { recruiting: true },
  );
  assert.equal(res.ok, true);
  assert.deepEqual(res.errors, {});
});

test('필수 항목 누락 시 ok=false, 누락 필드에 오류', () => {
  const res = validateApplication({}, { recruiting: true });
  assert.equal(res.ok, false);
  assert.ok(res.errors.name, 'name 오류 있어야');
  assert.ok(res.errors.phone, 'phone 오류 있어야');
  assert.ok(res.errors.blogUrl, 'blogUrl 오류 있어야');
  assert.ok(res.errors.agree, 'agree 오류 있어야');
});

test('잘못된 휴대폰 형식이면 phone 오류', () => {
  const res = validateApplication(
    { name: '김고방', phone: '123', blogUrl: 'https://blog.naver.com/x', agree: true },
    { recruiting: true },
  );
  assert.equal(res.ok, false);
  assert.ok(res.errors.phone);
});

test('http(s)로 시작하지 않는 블로그 URL은 blogUrl 오류', () => {
  const res = validateApplication(
    { name: '김고방', phone: '010-1234-5678', blogUrl: 'naver.com/x', agree: true },
    { recruiting: true },
  );
  assert.equal(res.ok, false);
  assert.ok(res.errors.blogUrl);
});

test('모집중이 아니면 ok=false, recruiting 오류', () => {
  const res = validateApplication(
    { name: '김고방', phone: '010-1234-5678', blogUrl: 'https://blog.naver.com/x', agree: true },
    { recruiting: false },
  );
  assert.equal(res.ok, false);
  assert.ok(res.errors.recruiting);
});

test('normalizePhone: 다양한 입력을 010-0000-0000으로 표준화', () => {
  assert.equal(normalizePhone('01012345678'), '010-1234-5678');
  assert.equal(normalizePhone('010-1234-5678'), '010-1234-5678');
  assert.equal(normalizePhone('010 1234 5678'), '010-1234-5678');
});

test('normalizePhone: 잘못된 번호는 null', () => {
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizePhone(undefined), null);
});

test('upsertParticipant: 새 휴대폰은 추가', () => {
  const out = upsertParticipant([], { phone: '010-1111-2222', name: '김고방' });
  assert.equal(out.length, 1);
  assert.equal(out[0].phone, '010-1111-2222');
});

test('upsertParticipant: 같은 휴대폰은 갱신(행 증가 없음)', () => {
  const rows = [{ phone: '010-1111-2222', name: '김고방', blogUrl: 'a' }];
  const out = upsertParticipant(rows, { phone: '010-1111-2222', name: '박개방', blogUrl: 'b' });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, '박개방');
  assert.equal(out[0].blogUrl, 'b');
});

test('upsertParticipant: 원본 배열을 변형하지 않는다', () => {
  const rows = [{ phone: '010-1111-2222', name: '김고방' }];
  upsertParticipant(rows, { phone: '010-3333-4444', name: '박개방' });
  assert.equal(rows.length, 1);
});
