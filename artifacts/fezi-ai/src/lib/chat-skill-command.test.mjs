import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilityCommand, skillDisplayText, splitSkillDisplay } from './chat-skill-command.ts';

test('a special action remains a distinct command after chat history is restored', () => {
  const displayed = skillDisplayText('داستانی با چهار شخصیت بساز', '/ساخت_پرامپت');
  assert.deepEqual(splitSkillDisplay(displayed), {
    command: '/ساخت_پرامپت',
    body: 'داستانی با چهار شخصیت بساز',
  });
  assert.deepEqual(splitSkillDisplay('داستانی با چهار شخصیت بساز'), {
    command: null,
    body: 'داستانی با چهار شخصیت بساز',
  });
});

test('capability buttons produce readable command labels without HTML', () => {
  assert.equal(capabilityCommand('design', 'طراحی عکس'), '/طراحی_عکس');
  assert.equal(capabilityCommand('design', '<img onerror=alert(1)>'), '/img_onerroralert1');
});