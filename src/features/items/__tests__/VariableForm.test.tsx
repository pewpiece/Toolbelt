import { fireEvent, render, screen } from '@testing-library/react-native';

import { VariableForm } from '../VariableForm';

describe('VariableForm', () => {
  it('renders one field per variable and submits the entered values', async () => {
    const onSubmit = jest.fn();
    await render(
      <VariableForm visible title="SSH" variables={['user', 'host']} onSubmit={onSubmit} onCancel={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByTestId('var-user'), 'root');
    await fireEvent.changeText(screen.getByTestId('var-host'), 'example.com');
    await fireEvent.press(screen.getByTestId('var-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ user: 'root', host: 'example.com' });
  });

  it('calls onCancel', async () => {
    const onCancel = jest.fn();
    await render(<VariableForm visible title="x" variables={['a']} onSubmit={jest.fn()} onCancel={onCancel} />);
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders nothing while hidden', async () => {
    await render(<VariableForm visible={false} title="x" variables={['a']} onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByTestId('var-a')).toBeNull();
  });
});
