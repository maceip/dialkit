import type { Annotation } from '../../../annotation/types';

export function AnnotationMarker(props: {
  annotation: Annotation;
  index: number;
  onSelect: () => void;
}) {
  const scrollY = () => (typeof window !== 'undefined' ? window.scrollY : 0);
  const top = () => (props.annotation.isFixed ? props.annotation.y : props.annotation.y - scrollY());
  const left = () => `${props.annotation.x}%`;

  return (
    <button
      type="button"
      class="dk-ann-marker"
      data-annotation-marker
      data-fixed={props.annotation.isFixed ? 'true' : undefined}
      style={{ left: left(), top: `${top()}px` }}
      title={props.annotation.comment}
      onClick={(e) => {
        e.stopPropagation();
        props.onSelect();
      }}
    >
      {props.index + 1}
    </button>
  );
}
