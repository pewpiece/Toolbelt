import { fireEvent, render, screen } from '@testing-library/react-native';

import EditItem from '../../app/item/edit';
import { routerState, resetRouter } from './expoRouterMock';
import { freshApp } from './harness';

jest.mock('expo-router', () => require('./expoRouterMock').expoRouterMock);

beforeEach(resetRouter);

describe('Add / edit item screen', () => {
  it('creates an item and navigates to its detail screen, ignoring a double tap', async () => {
    const repos = freshApp();
    await render(<EditItem />);
    await fireEvent.changeText(screen.getByTestId('field-title'), 'Docker prune');
    await fireEvent.changeText(screen.getByTestId('field-body'), 'docker system prune');
    await fireEvent.press(screen.getByTestId('submit-item'));
    await fireEvent.press(screen.getByTestId('submit-item'));
    const items = repos.items.list();
    expect(items).toHaveLength(1);
    expect(routerState.replace).toHaveBeenCalledTimes(1);
    expect(routerState.replace).toHaveBeenCalledWith({ pathname: '/item/[id]', params: { id: String(items[0].id) } });
  });

  it('allows retry after a validation error', async () => {
    const repos = freshApp();
    await render(<EditItem />);
    await fireEvent.press(screen.getByTestId('submit-item'));
    expect(screen.getByText('Title is required.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('field-title'), 'T');
    await fireEvent.changeText(screen.getByTestId('field-body'), 'B');
    await fireEvent.press(screen.getByTestId('submit-item'));
    expect(repos.items.list()).toHaveLength(1);
  });

  it('editing a pack item saves it as the user\'s own and explains that first', async () => {
    const repos = freshApp({ seed: true });
    const packItem = repos.items.list({ category: 'Reference' })[0];
    routerState.params = { id: String(packItem.id) };
    await render(<EditItem />);
    expect(screen.getByText(/This item comes from a pack/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('field-body'), 'changed body');
    await fireEvent.press(screen.getByTestId('submit-item'));
    expect(repos.items.get(packItem.id)).toMatchObject({ body: 'changed body', source: 'user' });
    expect(routerState.back).toHaveBeenCalled();
  });

  it('shows a message when editing an item that no longer exists', async () => {
    freshApp();
    routerState.params = { id: '12345' };
    await render(<EditItem />);
    expect(screen.getByText('Item not found')).toBeTruthy();
  });
});
