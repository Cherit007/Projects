import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplateManager from '../components/TemplateManager';

vi.mock('../components/AutocompleteInput', () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const template = {
  id: 'tpl-1',
  name: 'League Night',
  tournamentFormat: 'league',
  gameMode: 'doubles',
  format: '1',
  numTeams: 3,
  teams: [
    { id: 1, name: 'Team 1', player1: 'Alice', player2: 'Bea' },
    { id: 2, name: 'Team 2', player1: 'Cara', player2: 'Diya' },
    { id: 3, name: 'Team 3', player1: 'Eva', player2: 'Faye' },
  ],
};

const currentConfig = {
  tournamentFormat: 'league',
  gameMode: 'doubles',
  format: '1',
  numTeams: 3,
};

describe('TemplateManager actions', () => {
  it('applies a template config directly when onApplyConfig is provided', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onApplyConfig = vi.fn();

    render(
      <TemplateManager
        templates={[template]}
        currentConfig={currentConfig}
        onSave={vi.fn(() => ({ success: true }))}
        onApply={onApply}
        onApplyConfig={onApplyConfig}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /^Apply$/i }));

    expect(onApplyConfig).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tpl-1',
      name: 'League Night',
      tournamentFormat: 'league',
    }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('falls back to applying the template id when direct config apply is unavailable', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();

    render(
      <TemplateManager
        templates={[template]}
        currentConfig={currentConfig}
        onSave={vi.fn(() => ({ success: true }))}
        onApply={onApply}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /^Apply$/i }));

    expect(onApply).toHaveBeenCalledWith('tpl-1');
  });

  it('edits an existing template and saves the updated draft', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => ({ success: true }));

    render(
      <TemplateManager
        templates={[template]}
        currentConfig={currentConfig}
        playerSuggestions={['Alice', 'Bea']}
        teamNameSuggestions={['Team 1']}
        onSave={onSave}
        onApply={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /^Edit$/i }));

    const nameInput = screen.getByPlaceholderText(/Template name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'League Night Updated');
    await user.click(screen.getByRole('button', { name: /Save Template/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tpl-1',
      name: 'League Night Updated',
      tournamentFormat: 'league',
      numTeams: 3,
    }));
  });

  it('deletes the selected template', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <TemplateManager
        templates={[template]}
        currentConfig={currentConfig}
        onSave={vi.fn(() => ({ success: true }))}
        onApply={vi.fn()}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button', { name: /^Delete$/i }));

    expect(onDelete).toHaveBeenCalledWith('tpl-1');
  });
});
