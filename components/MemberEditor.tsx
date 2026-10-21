'use client';
import { useState } from 'react';
import { parseNames } from '@/src/shared/lib/party-members';
export default function MemberEditor({
  members,
  disabled,
  onChange,
}: {
  members: string[];
  disabled: boolean;
  onChange: (members: string[]) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const commit = async (next: string[], clear = false) => {
    setSaving(true);
    try {
      if (await onChange(next)) {
        if (clear) setDraft('');
        setMessage(`${next.length}명 등록됨`);
      }
    } catch {
      setMessage('명단을 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };
  const add = () => {
    const names = parseNames(draft);
    if (names.length) void commit([...members, ...names], true);
  };
  return (
    <fieldset disabled={disabled || saving} className="mt-3 min-w-0">
      <label htmlFor="team-member-name" className="mb-2 block text-sm font-semibold">
        이름 추가
      </label>
      <div className="flex gap-2">
        <input
          id="team-member-name"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          onPaste={e => {
            const text = e.clipboardData.getData('text');
            if (/[,\r\n]/.test(text)) {
              e.preventDefault();
              setDraft(current => current + text.replace(/[\r\n]+/g, ', '));
            }
          }}
          placeholder="예: 민지, 현우"
          autoComplete="off"
          enterKeyHint="done"
          className="min-w-0 flex-1 rounded-xl border border-chocolate07/25 px-3 py-3 text-base focus:outline-2 focus:outline-chocolate07"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="shrink-0 rounded-xl bg-chocolate07 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          추가
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-chocolate05">
        쉼표나 줄바꿈으로 여러 이름을 붙여넣고 추가해도 돼요. 같은 이름은 번호로 구분해요.
      </p>
      {members.length > 0 && (
        <ul aria-label="등록된 참여자" className="mt-4 flex flex-wrap gap-2">
          {members.map((member, index) => (
            <li
              key={`${index}-${member}`}
              className="flex max-w-full items-center rounded-full border border-chocolate07/15 bg-[#f8f3ec] pl-3 text-sm"
            >
              <span className="break-all">{member}</span>
              <button
                type="button"
                aria-label={`${member} 삭제`}
                onClick={() => void commit(members.filter((_, i) => i !== index))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">
        {saving ? '명단 저장 중' : message}
      </p>
    </fieldset>
  );
}
