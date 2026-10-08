import { fireEvent, render, screen } from '@testing-library/react-native';

import { createRepos } from '@/data';
import { createTestDb } from '@/db/testing';

import { ItemForm } from '../ItemForm';

describe('ItemForm', () => {
  it('shows a validation error next to the field and does not save', async () => {
    const repos = createRepos(createTestDb());
    const onSubmit = jest.fn((input) => repos.items.create(input));
    await render(<ItemForm onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByTestId('submit-item'));
    expect(screen.getByText('Title is required.')).toBeTruthy();
    expect(repos.items.count()).toBe(0);

    await fireEvent.changeText(screen.getByTestId('field-title'), 'Hello');
    await fireEvent.press(screen.getByTestId('submit-item'));
    expect(screen.getByText('Body is required.')).toBeTruthy();
  });

  it('submits cleaned input including tags and type', async () => {
    const repos = createRepos(createTestDb());
    await render(<ItemForm onSubmit={(input) => repos.items.create(input)} />);
    await fireEvent.changeText(screen.getByTestId('field-title'), 'Undo');
    await fireEvent.changeText(screen.getByTestId('field-body'), 'git reset --soft HEAD~1');
    await fireEvent.changeText(screen.getByTestId('field-tags'), 'Git, undo ,');
    await fireEvent.press(screen.getByTestId('type-command'));
    await fireEvent.press(screen.getByTestId('submit-item'));
    const [saved] = repos.items.list();
    expect(saved).toMatchObject({ title: 'Undo', type: 'command', tags: ['git', 'undo'] });
  });

  it('surfaces non-validation errors at the bottom', async () => {
    await render(
      <ItemForm
        onSubmit={() => {
          throw new Error('disk full');
        }}
      />,
    );
    await fireEvent.press(screen.getByTestId('submit-item'));
    expect(screen.getByText('disk full')).toBeTruthy();
  });
});
