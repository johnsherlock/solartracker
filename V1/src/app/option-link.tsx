interface OptionLinkProps {
  dispatch: React.Dispatch<any>;
  type: string;
  payload: string;
  selected: boolean;
  text: string;
}

const OptionLink = ({ dispatch, type, payload, selected, text }: OptionLinkProps) => {
  const handleClick = () => {
    if (!selected) {
      dispatch({ type, payload });
    }
  };

  const className = selected ? '' : 'option-link';

  return (
    <span className={className} onClick={handleClick}>
      {text}
    </span>
  );
};

export default OptionLink;