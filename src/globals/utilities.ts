export type ClassOf<T> = { new (...args: any[]): T }; // javascript is so weird... this syntax is disgusting lol

// Gets element by ID and checks that it is of the expected type
export function getByID<T extends HTMLElement>(
    id: string,
    myClass: ClassOf<T>
): T {
    const element = document.getElementById(id);
    if(!(element instanceof myClass)) {
        throw new Error(`Missing element: ${id}`);
    }
    return element;
}
