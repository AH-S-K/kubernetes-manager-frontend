import { Fragment } from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface Crumb {
  label: string;
  /** Route for navigable ancestors. Omit for context names (cluster/namespace)
   *  and for the current page. */
  to?: string;
}

/**
 * Rendering rules:
 *   last item            → <BreadcrumbPage> (aria-current="page")
 *   has `to`             → react-router <Link>
 *   no `to`, not last    → muted span (entity context, e.g. "prod-cluster")
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem>
                {item.to && !isLast ? (
                  <BreadcrumbLink
                    render={
                      <Link to={item.to} className="max-w-[14rem] truncate" />
                    }
                  >
                    {item.label}
                  </BreadcrumbLink>
                ) : isLast ? (
                  <BreadcrumbPage className="max-w-[14rem] truncate">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <span className="max-w-[14rem] truncate text-muted-foreground">
                    {item.label}
                  </span>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
